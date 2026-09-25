import { unlink } from "node:fs/promises";
import { prisma } from "../lib/prisma";
import { privateMediaDiskPath } from "../lib/storage";
/** Borra el archivo de relleno de la prueba de subida grande (25-sep) de los documentos de la capacitación. */
const ACT = "cmuh0e3gm0002aml8kw3fi97g";
async function main() {
  const docs = await prisma.media.findMany({ where: { trainingActivityId: ACT, fileName: { contains: "PRUEBA-subida-grande" } }, select: { id: true, folder: true, fileName: true, fileSize: true } });
  for (const d of docs) {
    if (d.folder) await unlink(privateMediaDiskPath(d.folder, d.fileName)).catch(() => {});
    await prisma.media.delete({ where: { id: d.id } });
    console.log(`borrado ${d.fileName} (${Math.round(d.fileSize / 1_048_576)} MB)`);
  }
  if (docs.length === 0) console.log("no había archivos de prueba");
}
main().finally(() => prisma.$disconnect());
