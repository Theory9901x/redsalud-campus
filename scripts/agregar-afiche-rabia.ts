import path from "node:path";
import { randomUUID } from "node:crypto";
import { copyFile, mkdir, stat } from "node:fs/promises";
import { prisma } from "../lib/prisma";

/**
 * Único material NUEVO de la carpeta PLANCAPACITACION (oct-2026) frente a lo
 * montado en agosto: el afiche «Algoritmo de atención de rabia», del área de
 * Vacunación (T1 · Vacunación antirrábica). Se agrega como lección PDF al
 * curso ya publicado, al final del módulo, igual que se montaron las demás
 * (prisma/montar-trimestres.ts). Idempotente por título.
 *
 *   npx tsx --env-file=.env scripts/agregar-afiche-rabia.ts <ruta-del-pdf>
 */
const CURSO = "cmsp4jnwu007khsl8jvvusfyp";
const TITULO = "Afiche · Algoritmo de atención de rabia";
const UPLOADS = path.join(process.cwd(), "uploads");

async function main() {
  const origen = process.argv[2];
  if (!origen) throw new Error("Falta la ruta del PDF.");
  const curso = await prisma.course.findUniqueOrThrow({
    where: { id: CURSO },
    select: { title: true, tutorId: true, modules: { orderBy: { sortOrder: "asc" }, take: 1, select: { id: true, lessons: { select: { title: true, sortOrder: true } } } } },
  });
  const modulo = curso.modules[0];
  if (!modulo) throw new Error("El curso no tiene módulo.");
  if (modulo.lessons.some((l) => l.title === TITULO)) {
    console.log("Ya estaba: no se hace nada.");
    return;
  }
  const orden = Math.max(-2, ...modulo.lessons.map((l) => l.sortOrder)) + 2;
  const leccion = await prisma.lesson.create({
    data: { moduleId: modulo.id, title: TITULO, contentType: "PDF", sortOrder: orden, estimatedMinutes: 5 },
  });
  const folder = `lessons/${leccion.id}`;
  await mkdir(path.join(UPLOADS, folder), { recursive: true });
  const fileName = `${Date.now()}-vac-antirrabica-afiche-algoritmo-rabia.pdf`;
  await copyFile(origen, path.join(UPLOADS, folder, fileName));
  const { size } = await stat(path.join(UPLOADS, folder, fileName));
  const id = randomUUID();
  await prisma.media.create({
    data: { id, fileName, fileType: "application/pdf", fileSize: size, folder, fileUrl: `/api/media/${id}`, uploadedBy: curso.tutorId },
  });
  await prisma.lesson.update({ where: { id: leccion.id }, data: { fileUrl: `/api/media/${id}` } });
  console.log(`Agregada «${TITULO}» (${(size / 1048576).toFixed(1)} MB) al curso «${curso.title}», orden ${orden}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
