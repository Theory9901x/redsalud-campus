import { readFile } from "node:fs/promises";
import { prisma } from "../lib/prisma";

/**
 * Cambia la descripción de un video de la Videoteca desde un archivo de texto
 * (las líneas "Plataforma: / Usuario: / Contraseña:" se muestran como datos
 * de acceso debajo del video).
 *
 * Uso: npx tsx --env-file=.env scripts/editar-video.ts <videoId> <archivo.txt>
 */
async function main() {
  const [id, archivo] = process.argv.slice(2);
  if (!id || !archivo) throw new Error("Uso: editar-video.ts <videoId> <archivo.txt>");
  const descripcion = (await readFile(archivo, "utf8")).trim().slice(0, 2000);
  const v = await prisma.videoCapacitacion.update({ where: { id }, data: { descripcion }, select: { titulo: true } });
  console.log(`actualizado: «${v.titulo}»`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
