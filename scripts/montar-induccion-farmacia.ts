import "dotenv/config";
import { randomUUID } from "node:crypto";
import { copyFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import { prisma } from "../lib/prisma";

/** Importa la guía y las cinco preguntas entregadas por Farmacia.
 * Uso: npx tsx scripts/montar-induccion-farmacia.ts VIDEO.mp4 EVALUACION.xlsx [--aplicar]
 * Primero valida y muestra el contenido. --aplicar publica todo en una transacción.
 * La clave se toma del resaltado amarillo del Excel y nunca se publica como adjunto.
 */
const MODULO = "Servicio Farmacéutico";
const LECCION = "Guía de inducción al Servicio Farmacéutico";
const EVALUACION = "Evaluación · Servicio Farmacéutico";

async function main() {
  const [video, excel] = process.argv.slice(2);
  if (!video || !excel) throw new Error("Indica las rutas del video y del Excel.");
  const videoInfo = await stat(video);
  if (videoInfo.size === 0) throw new Error("El video está vacío.");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(excel);
  const sheet = workbook.getWorksheet("S.F");
  if (!sheet) throw new Error("No se encontró la hoja S.F de la evaluación original.");
  const preguntas = [9, 14, 19, 24, 29].map((fila, n) => {
    const statement = sheet.getCell(`A${fila}`).text.trim().replace(/^PREGUNTA\s+No\.?\s*\d+\.?\s*/i, "").trim();
    const options = [1, 2, 3, 4].map((offset, sortOrder) => {
      const cell = sheet.getCell(`A${fila + offset}`);
      const fill = cell.fill;
      const isCorrect = fill.type === "pattern" && fill.pattern === "solid" && fill.fgColor?.argb?.toUpperCase() === "FFFFFF00";
      const text = cell.text.trim().replace(/^[A-D]\)\s*/, "").trim();
      if (!text) throw new Error(`Opción vacía en la pregunta ${n + 1}.`);
      return { text, sortOrder, isCorrect };
    });
    if (!statement || options.filter((o) => o.isCorrect).length !== 1) throw new Error(`Pregunta ${n + 1}: falta un enunciado o una única respuesta resaltada.`);
    return { statement, sortOrder: n, options };
  });
  const course = await prisma.course.findUniqueOrThrow({ where: { slug: "induccion-y-reinduccion" }, select: { id: true, title: true } });
  const uploader = await prisma.user.findFirstOrThrow({ where: { username: "farmacia", status: "ACTIVE" }, select: { id: true } });
  console.log(JSON.stringify({ curso: course.title, modulo: MODULO, videoBytes: videoInfo.size, preguntas: preguntas.length, respuestas: preguntas.map((p) => "ABCD"[p.options.findIndex((o) => o.isCorrect)]), aprobacion: 60, intentos: 10 }, null, 2));
  if (!process.argv.includes("--aplicar")) return;

  const existing = await prisma.courseModule.findFirst({
    where: { courseId: course.id, title: MODULO },
    include: { lessons: true, quizzes: { include: { questions: true } } },
  });
  if (existing) {
    const lesson = existing.lessons.find((l) => l.title === LECCION);
    const quiz = existing.quizzes.find((q) => q.title === EVALUACION);
    if (lesson?.fileUrl && quiz?.questions.length === 5) {
      console.log("El módulo ya está cargado. No se modifica contenido ni intentos existentes.");
      return;
    }
    throw new Error("Ya hay un módulo de Servicio Farmacéutico incompleto; revisarlo antes de importar.");
  }
  const moduleId = randomUUID();
  const lessonId = randomUUID();
  const mediaId = randomUUID();
  const fileName = "guia-induccion-servicio-farmaceutico.mp4";
  const folder = `lessons/${lessonId}`;
  const destination = path.join(process.cwd(), "uploads", folder);
  await mkdir(destination, { recursive: true });
  await copyFile(video, path.join(destination, fileName));
  if ((await stat(path.join(destination, fileName))).size !== videoInfo.size) throw new Error("La copia del video no está completa.");

  const result = await prisma.$transaction(async (tx) => {
    const last = await tx.courseModule.aggregate({ where: { courseId: course.id }, _max: { sortOrder: true } });
    const modulo = await tx.courseModule.create({ data: {
      id: moduleId, courseId: course.id, title: MODULO,
      description: "Guía de inducción y reinducción al Servicio Farmacéutico y evaluación de conocimientos entregadas por el área.",
      sortOrder: (last._max.sortOrder ?? 0) + 1, isActive: true, isRequired: true, audience: "AMBOS",
    } });
    await tx.media.create({ data: {
      id: mediaId, fileName, fileType: "video/mp4", fileSize: videoInfo.size,
      folder, fileUrl: `/api/media/${mediaId}`, uploadedBy: uploader.id,
    } });
    await tx.lesson.create({ data: {
      id: lessonId, moduleId, title: LECCION, contentType: "VIDEO", sortOrder: 1,
      fileUrl: `/api/media/${mediaId}`, estimatedMinutes: 22, isActive: true, isRequired: true,
      description: "Video institucional de inducción y reinducción del Servicio Farmacéutico. Al finalizar, presenta la evaluación del módulo.",
    } });
    const quiz = await tx.quiz.create({ data: {
      courseId: course.id, moduleId, title: EVALUACION,
      description: "Evaluación de cinco preguntas del Servicio Farmacéutico. Selecciona una respuesta por pregunta. Aprobación: 60 %.",
      passingScore: 60, maxAttempts: 10, sortOrder: 2, isActive: true,
      questions: { create: preguntas.map((p) => ({
        type: "SINGLE_CHOICE", statement: p.statement, area: MODULO, score: 1, sortOrder: p.sortOrder,
        options: { create: p.options },
      })) },
    } });
    await tx.auditLog.create({ data: {
      userId: uploader.id, action: "CREATE", entity: "CourseModule", entityId: moduleId,
      description: "Carga autorizada del material entregado por Farmacia: guía en video y evaluación Excel de 5 preguntas, claves tomadas de los resaltados del original.",
    } });
    return { moduleId: modulo.id, lessonId, quizId: quiz.id, fileUrl: `/api/media/${mediaId}` };
  });
  console.log("Publicado:", JSON.stringify(result));
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
