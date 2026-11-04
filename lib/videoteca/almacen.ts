import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { appendFile, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { privateMediaDiskPath } from "@/lib/storage";

/**
 * ALMACÉN DE LA VIDEOTECA
 *
 * Los videos se suben EN PARTES de 8 MB: nginx corta los cuerpos de más de
 * 30 MB y el proxy de Next los de más de 10 MB, y además una carga de cientos
 * de MB desde una red institucional se cae. Cada parte se reintenta sola y el
 * servidor la acepta una sola vez (por posición), así que repetir es seguro.
 *
 * Al terminar, el archivo se registra como Media (carpeta "videoteca") y ya
 * se puede ver. En segundo plano, si el servidor tiene ffmpeg, se genera una
 * portada y una versión optimizada para celular (H.264 720p, inicio rápido);
 * cuando está lista reemplaza al original.
 */

export const CARPETA = "videoteca";
export const TAMANO_PARTE = 8 * 1024 * 1024;
export const TAMANO_MAXIMO = 2 * 1024 * 1024 * 1024;
const PARCIALES = path.join(process.cwd(), "uploads", CARPETA, ".parciales");

export type CargaPendiente = {
  id: string;
  nombre: string;
  tipo: string;
  tamano: number;
  titulo: string;
  descripcion: string | null;
  categoria: string | null;
  duracionSeg: number | null;
  usuarioId: string;
  creada: number;
};

const rutaDatos = (id: string) => path.join(PARCIALES, `${id}.json`);
const rutaParte = (id: string) => path.join(PARCIALES, `${id}.part`);
const idValido = (id: string) => /^[0-9a-f-]{36}$/.test(id);

export async function iniciarCarga(datos: Omit<CargaPendiente, "id" | "creada">) {
  await mkdir(PARCIALES, { recursive: true });
  const carga: CargaPendiente = { ...datos, id: randomUUID(), creada: Date.now() };
  await writeFile(rutaDatos(carga.id), JSON.stringify(carga));
  await writeFile(rutaParte(carga.id), "");
  return carga;
}

export async function leerCarga(id: string, usuarioId: string): Promise<CargaPendiente | null> {
  if (!idValido(id)) return null;
  try {
    const c = JSON.parse(await readFile(rutaDatos(id), "utf8")) as CargaPendiente;
    return c.usuarioId === usuarioId ? c : null;
  } catch {
    return null;
  }
}

/** Agrega una parte en su posición. Devuelve cuántos bytes lleva la carga. */
export async function agregarParte(carga: CargaPendiente, desde: number, datos: Buffer) {
  const actual = (await stat(rutaParte(carga.id))).size;
  // Reintento de una parte que ya llegó: se ignora.
  if (desde + datos.length <= actual) return actual;
  if (desde !== actual) throw new Error(`Parte fuera de orden: se esperaba la posición ${actual}.`);
  if (actual + datos.length > carga.tamano) throw new Error("La parte excede el tamaño declarado.");
  await appendFile(rutaParte(carga.id), datos);
  return actual + datos.length;
}

function extension(nombre: string, tipo: string) {
  const ext = path.extname(nombre).toLowerCase().replace(/[^.a-z0-9]/g, "");
  if (ext && ext.length <= 5) return ext;
  return tipo === "video/webm" ? ".webm" : tipo === "video/quicktime" ? ".mov" : ".mp4";
}

/** Cierra la carga: mueve el archivo, crea Media + Video y lanza la optimización. */
export async function terminarCarga(carga: CargaPendiente) {
  const tam = (await stat(rutaParte(carga.id))).size;
  if (tam !== carga.tamano) throw new Error(`Faltan partes: llegaron ${tam} de ${carga.tamano} bytes.`);

  const mediaId = randomUUID();
  const fileName = `${mediaId}${extension(carga.nombre, carga.tipo)}`;
  const destino = privateMediaDiskPath(CARPETA, fileName);
  await mkdir(path.dirname(destino), { recursive: true });
  await rename(rutaParte(carga.id), destino);
  await rm(rutaDatos(carga.id), { force: true });

  const video = await prisma.videoCapacitacion.create({
    data: {
      titulo: carga.titulo,
      descripcion: carga.descripcion,
      categoria: carga.categoria,
      duracionSeg: carga.duracionSeg,
      creadoPor: carga.usuarioId,
      estado: "PROCESANDO",
      media: {
        create: {
          id: mediaId,
          fileName,
          fileType: carga.tipo || "video/mp4",
          fileSize: tam,
          folder: CARPETA,
          fileUrl: `/api/media/${mediaId}`,
          kind: "VIDEO",
          description: carga.titulo.slice(0, 200),
          uploadedBy: carga.usuarioId,
        },
      },
    },
    select: { id: true },
  });

  void optimizar(video.id).catch(() => {});
  return video;
}

/* ───────────── ffmpeg ───────────── */

function correr(cmd: string, args: string[]): Promise<{ ok: boolean; salida: string }> {
  return new Promise((resolve) => {
    let salida = "";
    let p: ReturnType<typeof spawn>;
    try {
      // nice 19 y un hilo: el mismo servidor atiende las videollamadas.
      p = spawn("nice", ["-n", "19", cmd, ...args], { stdio: ["ignore", "pipe", "pipe"] });
    } catch {
      return resolve({ ok: false, salida: "sin nice/ffmpeg" });
    }
    p.stdout?.on("data", (d) => (salida += d));
    p.stderr?.on("data", (d) => (salida = (salida + d).slice(-4000)));
    p.on("error", () => resolve({ ok: false, salida }));
    p.on("close", (code) => resolve({ ok: code === 0, salida }));
  });
}

/**
 * Portada + versión para celular. Si ffmpeg no está (desarrollo) o falla, el
 * video queda con el original, que igual se reproduce.
 */
export async function optimizar(videoId: string) {
  const v = await prisma.videoCapacitacion.findUnique({ where: { id: videoId }, include: { media: true } });
  if (!v) return;
  const original = privateMediaDiskPath(CARPETA, v.media.fileName);
  const base = v.media.id;

  // Duración real
  const probe = await correr("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", original]);
  const duracion = probe.ok ? Math.round(parseFloat(probe.salida.trim())) : NaN;
  if (!probe.ok) {
    await prisma.videoCapacitacion.update({ where: { id: videoId }, data: { estado: "LISTO" } });
    return;
  }

  // Portada a los 3 s (o al inicio si es más corto)
  const portada = `${base}-portada.jpg`;
  const instante = Number.isFinite(duracion) && duracion > 6 ? "3" : "0";
  const p = await correr("ffmpeg", ["-y", "-ss", instante, "-i", original, "-frames:v", "1", "-vf", "scale=960:-2", "-q:v", "4", privateMediaDiskPath(CARPETA, portada)]);
  await prisma.videoCapacitacion.update({
    where: { id: videoId },
    data: { ...(p.ok ? { portada } : {}), ...(Number.isFinite(duracion) ? { duracionSeg: duracion } : {}) },
  });

  // Versión para celular: H.264 hasta 720p, audio AAC, moov al inicio.
  const salida = `${base}-web.mp4`;
  const rutaSalida = privateMediaDiskPath(CARPETA, salida);
  const t = await correr("ffmpeg", [
    "-y", "-i", original,
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "27", "-threads", "1",
    "-vf", "scale='min(1280,iw)':-2,fps=30",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "96k", "-ac", "2",
    "-movflags", "+faststart",
    rutaSalida,
  ]);
  if (!t.ok) {
    await rm(rutaSalida, { force: true });
    await prisma.videoCapacitacion.update({ where: { id: videoId }, data: { estado: "ERROR" } });
    return;
  }
  const nuevo = (await stat(rutaSalida)).size;
  // Solo se reemplaza si de verdad pesa menos.
  if (nuevo >= v.media.fileSize) {
    await rm(rutaSalida, { force: true });
    await prisma.videoCapacitacion.update({ where: { id: videoId }, data: { estado: "LISTO" } });
    return;
  }
  await prisma.$transaction([
    prisma.media.update({ where: { id: v.media.id }, data: { fileName: salida, fileSize: nuevo, fileType: "video/mp4" } }),
    prisma.videoCapacitacion.update({ where: { id: videoId }, data: { estado: "LISTO" } }),
  ]);
  await rm(original, { force: true });
}

export function rutaPortada(portada: string) {
  return privateMediaDiskPath(CARPETA, path.basename(portada));
}

export function leerPortada(portada: string) {
  return createReadStream(rutaPortada(portada));
}

/** Borra los archivos de un video (original/optimizado y portada). */
export async function borrarArchivos(fileName: string, portada: string | null) {
  await rm(privateMediaDiskPath(CARPETA, path.basename(fileName)), { force: true });
  if (portada) await rm(rutaPortada(portada), { force: true });
}
