import { randomUUID } from "node:crypto";
import { copyFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../lib/prisma";
import { privateMediaDiskPath } from "../lib/storage";
import { CARPETA, optimizar } from "../lib/videoteca/almacen";

/**
 * Registra en la Videoteca un video que ya está en el servidor (copiado por
 * scp), sin pasar por la carga del navegador. Lo publica, genera portada y
 * versión para celular (espera a que termine).
 *
 * Uso: npx tsx --env-file=.env scripts/registrar-video.ts <archivo> "<título>" [categoría] [descripción]
 */
async function main() {
  const [archivo, titulo, categoria = null, descripcion = null] = process.argv.slice(2);
  if (!archivo || !titulo) throw new Error('Uso: registrar-video.ts <archivo> "<título>" [categoría] [descripción]');
  const { size } = await stat(archivo);

  const yaEsta = await prisma.videoCapacitacion.findFirst({ where: { titulo }, select: { id: true } });
  if (yaEsta) {
    console.log(`ya existe: /videos/${yaEsta.id}`);
    return;
  }
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN", status: "ACTIVE", restrictedAdminSections: { isEmpty: true } },
    orderBy: { createdAt: "asc" },
    select: { id: true, fullName: true },
  });
  if (!admin) throw new Error("No hay un administrador activo para registrar el video.");

  const mediaId = randomUUID();
  const fileName = `${mediaId}${path.extname(archivo).toLowerCase() || ".mp4"}`;
  const destino = privateMediaDiskPath(CARPETA, fileName);
  await mkdir(path.dirname(destino), { recursive: true });
  await copyFile(archivo, destino);

  const video = await prisma.videoCapacitacion.create({
    data: {
      titulo,
      categoria,
      descripcion,
      creadoPor: admin.id,
      estado: "PROCESANDO",
      media: {
        create: { id: mediaId, fileName, fileType: "video/mp4", fileSize: size, folder: CARPETA, fileUrl: `/api/media/${mediaId}`, kind: "VIDEO", description: titulo.slice(0, 200), uploadedBy: admin.id },
      },
    },
    select: { id: true },
  });
  console.log(`registrado: /videos/${video.id} (a nombre de ${admin.fullName}); optimizando…`);
  await optimizar(video.id);
  const fin = await prisma.videoCapacitacion.findUnique({ where: { id: video.id }, select: { estado: true, duracionSeg: true, portada: true, media: { select: { fileSize: true } } } });
  console.log(`estado: ${fin?.estado} · duración ${fin?.duracionSeg}s · ${Math.round((fin?.media.fileSize ?? 0) / 1048576)} MB · portada ${fin?.portada ? "sí" : "no"}`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
