/**
 * Repara la cabecera de las grabaciones YA archivadas.
 *
 * Las subidas antes de que la reparación entrara en la subida quedaron sin
 * duración ni índice de búsqueda: se reproducen, pero el navegador muestra
 * 0:00 y no deja saltar a un punto sin descargar el archivo entero.
 *
 * Es idempotente: una grabación que ya tiene duración se deja como está. No
 * recodifica nada -copia las pistas-, así que no hay pérdida de calidad.
 *
 *   npx tsx --env-file=.env scripts/reparar-grabaciones.ts          (revisar)
 *   npx tsx --env-file=.env scripts/reparar-grabaciones.ts --aplicar
 */
import { execFile } from "node:child_process";
import { readFile, stat, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { prisma } from "../lib/prisma";
import { privateMediaDiskPath } from "../lib/storage";
import { repararDuracionWebm } from "../lib/webm-remux";

const ejecutar = promisify(execFile);
const APLICAR = process.argv.includes("--aplicar");

async function duracionDe(ruta: string): Promise<number | null> {
  try {
    const { stdout } = await ejecutar("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=nw=1:nk=1",
      ruta,
    ]);
    const n = Number(stdout.trim());
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

async function main() {
  const grabaciones = await prisma.media.findMany({
    where: { fileType: { startsWith: "video/" }, trainingActivityId: { not: null } },
    select: { id: true, fileName: true, folder: true, fileSize: true },
  });

  console.log(`Grabaciones archivadas: ${grabaciones.length}${APLICAR ? "" : "   (revisión: nada se modifica)"}\n`);
  let reparadas = 0;
  let yaEstaban = 0;

  for (const g of grabaciones) {
    if (!g.folder) continue;
    const ruta = privateMediaDiskPath(g.folder, g.fileName);

    const antes = await duracionDe(ruta);
    if (antes !== null) {
      yaEstaban++;
      console.log(`   = ${g.fileName}  ya tiene duración (${antes.toFixed(1)} s)`);
      continue;
    }

    if (!APLICAR) {
      console.log(`   ! ${g.fileName}  SIN duración -> se repararía`);
      reparadas++;
      continue;
    }

    const original = await readFile(ruta);
    const arreglado = await repararDuracionWebm(original);
    if (arreglado === original || arreglado.byteLength === original.byteLength) {
      console.log(`   x ${g.fileName}  no se pudo reparar; se deja intacta`);
      continue;
    }

    await writeFile(ruta, arreglado);
    // El tamaño cambia unos pocos KB al escribir la cabecera y el índice: el
    // registro debe reflejar el archivo real, no el de antes.
    const { size } = await stat(ruta);
    await prisma.media.update({ where: { id: g.id }, data: { fileSize: size } });

    const despues = await duracionDe(ruta);
    console.log(`   ✔ ${g.fileName}  reparada -> ${despues?.toFixed(1) ?? "?"} s`);
    reparadas++;
  }

  console.log(
    `\n${APLICAR ? "Reparadas" : "Por reparar"}: ${reparadas} · ya estaban bien: ${yaEstaban}` +
      (APLICAR ? "" : "\nVuelve a correrlo con --aplicar para escribir los cambios.")
  );
}

main()
  .catch((e) => {
    console.error("FALLÓ:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
