/**
 * Monta el módulo SST en el curso de Inducción y reinducción:
 *   - Presentación (PDF, convertida del PowerPoint)  -> primero
 *   - Videos                                          -> luego
 *   - Evaluación (quiz de curso, 1 sola, 60%)         -> al final
 *
 * Idempotente en lo grueso: si ya existe el módulo "SST" aborta, para no
 * duplicar. Corre con:  node --env-file=.env node_modules/tsx/dist/cli.mjs prisma/mount-sst.ts
 */
import { randomUUID } from "node:crypto";
import path from "node:path";
import { mkdir, copyFile, stat, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { prisma } from "../lib/prisma";

const UPLOADS = path.join(process.cwd(), "uploads");
const PUBLIC_UPLOADS = path.join(process.cwd(), "public", "uploads");

// Rutas de origen (se pasan por env para poder correr igual en dev y en el VPS).
const SRC = process.env.SST_SRC ?? "C:\\Users\\USUARIO\\Desktop\\SST\\drive-download-20260723T224043Z-1-001";
const PDF = process.env.SST_PDF ?? path.join(process.cwd(), "..", "induccion-sst.pdf");
const IMG_POSTURAS = process.env.SST_IMG ?? path.join(process.cwd(), "..", "posturas.png");

const sanitize = (name: string) => {
  const ext = path.extname(name).toLowerCase();
  const base = path.basename(name, ext).replace(/[^a-zA-Z0-9-_]/g, "-").slice(0, 60);
  return `${Date.now()}-${base}${ext}`;
};

async function crearLeccionArchivo(opts: {
  moduleId: string;
  title: string;
  sortOrder: number;
  contentType: "PDF" | "VIDEO";
  srcPath: string;
  fileType: string;
  uploadedBy: string;
  estimatedMinutes?: number;
}) {
  const lesson = await prisma.lesson.create({
    data: {
      moduleId: opts.moduleId,
      title: opts.title,
      contentType: opts.contentType,
      sortOrder: opts.sortOrder,
      estimatedMinutes: opts.estimatedMinutes ?? null,
    },
  });

  const folder = `lessons/${lesson.id}`;
  const dir = path.join(UPLOADS, folder);
  await mkdir(dir, { recursive: true });
  const fileName = sanitize(path.basename(opts.srcPath));
  await copyFile(opts.srcPath, path.join(dir, fileName));
  const size = (await stat(path.join(dir, fileName))).size;

  const id = randomUUID();
  await prisma.media.create({
    data: {
      id,
      fileName,
      fileType: opts.fileType,
      fileSize: size,
      folder,
      fileUrl: `/api/media/${id}`,
      uploadedBy: opts.uploadedBy,
    },
  });

  await prisma.lesson.update({ where: { id: lesson.id }, data: { fileUrl: `/api/media/${id}` } });
  console.log(`  · lección "${opts.title}" (${opts.contentType}) ${(size / 1e6).toFixed(1)} MB`);
  return lesson;
}

async function main() {
  const course = await prisma.course.findFirst({
    where: { title: { contains: "Inducción y reinducción", mode: "insensitive" } },
    select: { id: true, title: true, tutorId: true },
  });
  if (!course) throw new Error("No se encontró el curso de Inducción y reinducción.");
  console.log(`Curso: ${course.title} (${course.id})`);

  const yaExiste = await prisma.courseModule.findFirst({ where: { courseId: course.id, title: "SST" } });
  if (yaExiste) throw new Error("El módulo SST ya existe. Aborto para no duplicar.");

  const maxOrder = await prisma.courseModule.aggregate({
    where: { courseId: course.id },
    _max: { sortOrder: true },
  });
  const modulo = await prisma.courseModule.create({
    data: {
      courseId: course.id,
      title: "SST",
      description: "Sistema de Gestión de Seguridad y Salud en el Trabajo.",
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
  });
  console.log(`Módulo SST creado (${modulo.id})`);

  // 1) Presentación PDF, 2) y 3) videos.
  await crearLeccionArchivo({
    moduleId: modulo.id,
    title: "Presentación · Inducción SG-SST",
    sortOrder: 0,
    contentType: "PDF",
    srcPath: PDF,
    fileType: "application/pdf",
    uploadedBy: course.tutorId,
    estimatedMinutes: 20,
  });
  await crearLeccionArchivo({
    moduleId: modulo.id,
    title: "Video · Riesgo biológico",
    sortOrder: 1,
    contentType: "VIDEO",
    srcPath: path.join(SRC, "riesgo biológico.mp4"),
    fileType: "video/mp4",
    uploadedBy: course.tutorId,
    estimatedMinutes: 15,
  });
  await crearLeccionArchivo({
    moduleId: modulo.id,
    title: "Video · Complemento SG-SST",
    sortOrder: 2,
    contentType: "VIDEO",
    srcPath: path.join(SRC, "videoplayback.mp4"),
    fileType: "video/mp4",
    uploadedBy: course.tutorId,
    estimatedMinutes: 5,
  });

  // Evaluación: 1 sola por curso (moduleId null), 60% para aprobar.
  const quizExiste = await prisma.quiz.findFirst({ where: { courseId: course.id, moduleId: null } });
  if (quizExiste) {
    console.log("Ya hay evaluación final del curso; no se crea otra.");
    return;
  }

  const quiz = await prisma.quiz.create({
    data: {
      courseId: course.id,
      moduleId: null,
      title: "Evaluación de Inducción y Reinducción del SG-SST",
      description: "Responde según lo visto en la presentación y los videos. Puntaje mínimo para aprobar: 60%.",
      passingScore: 60,
      maxAttempts: 3,
      showResultsNow: true,
    },
  });
  console.log(`Evaluación creada (${quiz.id})`);

  // Imagen de la pregunta de posturas -> webp público.
  const dirImg = path.join(PUBLIC_UPLOADS, "quiz", quiz.id);
  await mkdir(dirImg, { recursive: true });
  const webp = await sharp(IMG_POSTURAS).resize({ width: 1000, withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
  await writeFile(path.join(dirImg, "posturas.webp"), webp);
  const posturasUrl = `/uploads/quiz/${quiz.id}/posturas.webp`;

  type P = {
    type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE" | "OPEN_TEXT";
    statement: string;
    imageUrl?: string;
    explanation?: string;
    options?: { text: string; isCorrect: boolean }[];
  };

  // Preguntas del formato de evaluación. Las de opción/verdadero-falso e imagen
  // se auto-califican; las abiertas se guardan para consulta y no suman al
  // puntaje (su "respuesta de referencia" va en explanation).
  const preguntas: P[] = [
    {
      type: "OPEN_TEXT",
      statement: "Mencione tres (3) responsabilidades del trabajador en seguridad y salud en el trabajo.",
      explanation:
        "Por ejemplo: cuidar su salud y la de sus compañeros, usar los elementos de protección personal, cumplir las normas del SG-SST, reportar condiciones y actos inseguros, y participar en las actividades de prevención.",
    },
    {
      type: "OPEN_TEXT",
      statement: "¿Cuál es el objetivo de la Seguridad y Salud en el Trabajo?",
      explanation:
        "Prevenir lesiones y enfermedades causadas por las condiciones de trabajo, y proteger y promover la salud de los trabajadores, mediante la identificación, evaluación y control de los peligros y riesgos.",
    },
    {
      type: "SINGLE_CHOICE",
      statement: "¿Qué se debe hacer en caso de un accidente de trabajo?",
      options: [
        { text: "Reportar a jefe inmediato", isCorrect: false },
        { text: "Reportar al Vigía o Responsable SG-SST", isCorrect: false },
        { text: "Llamar a la ARL", isCorrect: false },
        { text: "La opción a y b son correctas", isCorrect: true },
      ],
    },
    {
      type: "TRUE_FALSE",
      statement:
        "Un acto o comportamiento inseguro se refiere a todas las acciones, decisiones, omisiones y fallas humanas que pueden dar origen a un incidente o accidente de trabajo.",
      options: [
        { text: "Verdadero", isCorrect: true },
        { text: "Falso", isCorrect: false },
      ],
    },
    {
      type: "TRUE_FALSE",
      statement:
        "Es accidente laboral todo suceso repentino que sobrevenga por causa o con ocasión del trabajo y que produzca en el trabajador una lesión orgánica, una perturbación funcional, una invalidez o la muerte. También, es aquel que se produce durante la ejecución de órdenes del empleador, o de una labor bajo su autoridad, aún fuera del lugar y horas de trabajo.",
      options: [
        { text: "Verdadero", isCorrect: true },
        { text: "Falso", isCorrect: false },
      ],
    },
    {
      type: "SINGLE_CHOICE",
      statement: "¿Cuáles son funciones del COPASST y/o Vigía SST?",
      options: [
        { text: "Participar en actividades de promoción, divulgación e información sobre medicina, higiene y seguridad ocupacional", isCorrect: false },
        { text: "Actuar como instrumento de vigilancia para el cumplimiento del SG-SST", isCorrect: false },
        { text: "Realizar inspecciones de seguridad", isCorrect: false },
        { text: "Todas las anteriores", isCorrect: true },
      ],
    },
    {
      type: "SINGLE_CHOICE",
      statement: "¿Qué hacer en caso de presentarse acoso laboral en su lugar de trabajo?",
      options: [
        { text: "Informar a la ARL", isCorrect: false },
        { text: "Reportar a quienes integran el comité de convivencia laboral", isCorrect: false },
        { text: "Reportar de manera formal al correo establecido", isCorrect: false },
        { text: "La opción b y c son correctas", isCorrect: true },
      ],
    },
    {
      type: "MULTIPLE_CHOICE",
      statement: "Observa la imagen. Marca TODAS las posturas CORRECTAS.",
      imageUrl: posturasUrl,
      options: [
        { text: "Sentado frente al escritorio con la espalda encorvada", isCorrect: false },
        { text: "Levantar una carga doblando la espalda", isCorrect: false },
        { text: "De pie con la espalda encorvada", isCorrect: false },
        { text: "Sentado frente al escritorio con la espalda recta", isCorrect: true },
        { text: "Levantar una carga en cuclillas, con la espalda recta", isCorrect: true },
        { text: "De pie con la espalda erguida", isCorrect: true },
      ],
    },
    {
      type: "OPEN_TEXT",
      statement: "Mencione tres (3) peligros en su área de trabajo.",
      explanation:
        "Depende del área. Por ejemplo: biológico (exposición a fluidos), biomecánico (posturas y cargas), locativo (pisos, escaleras), eléctrico, químico, psicosocial (carga laboral).",
    },
    {
      type: "SINGLE_CHOICE",
      statement: "Hacer una pausa activa consiste en:",
      options: [
        { text: "Ir a la cafetería", isCorrect: false },
        { text: "Hacer ejercicios físicos que incluyen fortalecimiento muscular, mejoramiento de la flexibilidad y la fatiga visual", isCorrect: true },
        { text: "Desplazarse a hacer sus necesidades fisiológicas", isCorrect: false },
      ],
    },
  ];

  for (const [i, p] of preguntas.entries()) {
    await prisma.question.create({
      data: {
        quizId: quiz.id,
        type: p.type,
        statement: p.statement,
        imageUrl: p.imageUrl ?? null,
        explanation: p.explanation ?? null,
        score: 1,
        sortOrder: i,
        options: { create: (p.options ?? []).map((o, idx) => ({ text: o.text, isCorrect: o.isCorrect, sortOrder: idx })) },
      },
    });
  }
  console.log(`  · ${preguntas.length} preguntas creadas`);
  console.log("Listo.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
