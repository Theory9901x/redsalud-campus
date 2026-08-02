/**
 * Monta en la plataforma los contenidos que ya entregaron las áreas y los
 * engancha a la línea del PIC que les corresponde.
 *
 * Una capacitación del plan queda completa cuando tiene las dos cosas que
 * mandó el área: la presentación y la evaluación. Aquí se crea un curso por
 * cada línea del PIC -así lo pidió la administración, por trimestres
 * separados- con su presentación como lección y su evaluación como quiz.
 *
 * Las preguntas NO se escriben aquí: salen de prisma/data/evaluaciones-areas.json,
 * extraído de los .docx originales por prisma/extraer-contenidos.ts. La clave
 * de respuestas es la que marcó el área, no una interpretación.
 *
 *   node --env-file=.env node_modules/tsx/dist/cli.mjs prisma/montar-contenidos-areas.ts
 *
 * Idempotente: si el curso ya existe, lo salta.
 */
import { randomUUID } from "node:crypto";
import path from "node:path";
import { mkdir, copyFile, stat } from "node:fs/promises";
import type { CourseAudience } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { slugify } from "../lib/slug";
import evaluaciones from "./data/evaluaciones-areas.json";

const UPLOADS = path.join(process.cwd(), "uploads");
const PDFS = path.join(process.cwd(), "contenidos-areas");

/** Mínimo para aprobar, igual que la evaluación de SG-SST ya publicada. */
const PUNTAJE_APROBACION = 60;
/** Diez intentos: es lo definido por la entidad para todas las evaluaciones. */
const INTENTOS = 10;

type Contenido = {
  /** Título exacto de la actividad en el PIC, para engancharla. */
  actividadPIC: string;
  curso: string;
  categoria: string;
  audiencia: CourseAudience;
  resumen: string;
  descripcion: string;
  capacitador: string;
  pdf: string;
  leccion: string;
  minutos: number;
  /** Nombre del .docx en evaluaciones-areas.json. */
  evaluacion: string;
};

const OBJETIVO_SIAU =
  "Brindar a todo el personal de Red Salud Casanare E.S.E. los conocimientos fundamentales sobre el " +
  "Sistema de Información y Atención al Usuario (SIAU), fortaleciendo el trato digno, la calidad del " +
  "servicio y la humanización en la atención en salud. Dirigido a todo el personal, sin importar su " +
  "modalidad de contrato.";

const CONTENIDOS: Contenido[] = [
  {
    actividadPIC: "CAPACITACION EN TRATO DIGNO Y CALIDAD DEL SERVICIO",
    curso: "Trato digno y calidad del servicio",
    categoria: "Atención al Usuario",
    audiencia: "AMBOS",
    resumen:
      "Principios de trato digno, actitud de servicio y protocolos de comunicación con el usuario en la atención en salud.",
    descripcion: OBJETIVO_SIAU,
    capacitador: "Yuribel Campos Arévalo",
    pdf: "MODULO TRATO DIGNO Y CALIDAD DEL SERVICIO.pdf",
    leccion: "Presentación · Trato digno y calidad del servicio",
    minutos: 20,
    evaluacion: "Evaluación 2 - Trato digno y calidad del servicio (1).docx",
  },
  {
    actividadPIC: "CAPACITACION EN PARTICIPACION SOCIAL EN SALUD",
    curso: "Participación social en salud",
    categoria: "Atención al Usuario",
    audiencia: "AMBOS",
    resumen:
      "Mecanismos y espacios de participación social en salud, marco normativo y su implementación en Red Salud Casanare.",
    descripcion: OBJETIVO_SIAU,
    capacitador: "Yuribel Campos Arévalo",
    pdf: "MODULO PARTICIPACIÓN SOCIAL EN SALUD.pdf",
    leccion: "Presentación · Participación social en salud",
    minutos: 20,
    evaluacion: "Evaluación 3 - Participación social en salud (1).docx",
  },
  {
    actividadPIC: "CAPACITACION HUMANIZACION EN SALUD",
    curso: "Humanización en salud",
    categoria: "Atención al Usuario",
    audiencia: "AMBOS",
    resumen:
      "Programa «Paraguas de Colores»: política, competencias y decálogo de humanización en la atención al paciente.",
    descripcion: OBJETIVO_SIAU,
    capacitador: "Yuribel Campos Arévalo",
    pdf: "MODULO HUMANIZACIÓN EN SALUD.pdf",
    leccion: "Presentación · Humanización en salud",
    minutos: 20,
    evaluacion: "Evaluación 4 - Humanización en salud (1).docx",
  },
  {
    actividadPIC: "Manejo del estrés y autocuidado",
    curso: "Manejo del estrés y autocuidado",
    categoria: "Talento Humano",
    audiencia: "ASISTENCIAL",
    resumen:
      "Herramientas prácticas para gestionar el estrés laboral, prevenir el desgaste emocional y promover el cuidado entre pares.",
    descripcion:
      "Brindar herramientas prácticas para gestionar el estrés laboral, prevenir el desgaste emocional y " +
      "promover el cuidado entre pares, a partir de la definición de estrés de la OMS, el modelo " +
      "transaccional de Lazarus y Folkman, y prácticas concretas de autocuidado.",
    capacitador: "Talento Humano",
    pdf: "ESTRES Y AUTOCUIDADO.pdf",
    leccion: "Presentación · Manejo del estrés y autocuidado",
    minutos: 30,
    evaluacion: "Evaluación de Capacitación manejo del estres.docx",
  },
];

/** Igual que la subida del panel: uploads/lessons/<id> y fileUrl = /api/media/<id>. */
async function adjuntarPdf(lessonId: string, origen: string, subidoPor: string) {
  const folder = `lessons/${lessonId}`;
  const dir = path.join(UPLOADS, folder);
  await mkdir(dir, { recursive: true });

  const fileName = `${Date.now()}-${path.basename(origen).replace(/[^a-zA-Z0-9-_.]/g, "-").slice(0, 60)}`;
  await copyFile(origen, path.join(dir, fileName));
  const { size } = await stat(path.join(dir, fileName));

  const id = randomUUID();
  await prisma.media.create({
    data: { id, fileName, fileType: "application/pdf", fileSize: size, folder, fileUrl: `/api/media/${id}`, uploadedBy: subidoPor },
  });
  await prisma.lesson.update({ where: { id: lessonId }, data: { fileUrl: `/api/media/${id}` } });
  return size;
}

async function main() {
  const tutor = await prisma.user.findFirstOrThrow({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
    select: { id: true, fullName: true },
  });

  for (const c of CONTENIDOS) {
    console.log(`\n── ${c.curso} ──`);

    const yaExiste = await prisma.course.findFirst({ where: { title: c.curso }, select: { id: true } });
    if (yaExiste) {
      console.log("  Ya existe. Se salta.");
      continue;
    }

    // La actividad del plan se busca ANTES de crear el curso: de ella sale el
    // área y, con el área, el tutor que responde por este contenido. Poner al
    // administrador como tutor sería falso -el material lo hizo el área- y
    // dejaría al área sin poder editar lo suyo.
    const actividad = await prisma.trainingActivity.findFirst({
      where: { title: c.actividadPIC },
      select: { id: true, quarters: true, area: { select: { name: true, tutorId: true } } },
    });
    const responsable = actividad?.area?.tutorId ?? tutor.id;

    const evaluacion = evaluaciones.evaluaciones.find((e) => e.archivo === c.evaluacion);
    if (!evaluacion) throw new Error(`No se encontró la evaluación «${c.evaluacion}» en el JSON extraído.`);

    const sinClave = evaluacion.preguntas.filter((p) => !p.opciones.some((o) => o.correcta));
    if (sinClave.length > 0) {
      throw new Error(`«${c.evaluacion}» tiene ${sinClave.length} preguntas sin respuesta correcta marcada. No se siembra a medias.`);
    }

    const categoria = await prisma.courseCategory.upsert({
      where: { name: c.categoria },
      update: {},
      create: { name: c.categoria },
    });

    const curso = await prisma.course.create({
      data: {
        title: c.curso,
        slug: slugify(c.curso),
        shortDescription: c.resumen,
        fullDescription: c.descripcion,
        categoryId: categoria.id,
        courseType: "CAPACITACION",
        // Sin intensidad horaria definida: la entidad la fija al cerrar la
        // vigencia, no antes.
        durationHours: 0,
        status: "PUBLISHED",
        publishedAt: new Date(),
        tutorId: responsable,
        passingScore: PUNTAJE_APROBACION,
        enrollmentMode: "ASSIGNED",
        targetAudience: c.audiencia,
        isSequential: true,
        instructions:
          `<p>Revisa la presentación completa y luego presenta la evaluación.</p>` +
          `<p>Necesitas <strong>${PUNTAJE_APROBACION}%</strong> para aprobar y tienes hasta ${INTENTOS} intentos.</p>` +
          `<p>Capacitador: ${c.capacitador}.</p>`,
      },
    });

    const modulo = await prisma.courseModule.create({
      data: { courseId: curso.id, title: c.curso, description: c.resumen, sortOrder: 0 },
    });

    const leccion = await prisma.lesson.create({
      data: { moduleId: modulo.id, title: c.leccion, contentType: "PDF", sortOrder: 0, estimatedMinutes: c.minutos },
    });
    const bytes = await adjuntarPdf(leccion.id, path.join(PDFS, c.pdf), responsable);
    console.log(`  Presentación: ${(bytes / 1048576).toFixed(1)} MB`);

    const quiz = await prisma.quiz.create({
      data: {
        courseId: curso.id,
        moduleId: null,
        title: `Evaluación · ${c.curso}`,
        description: `Responde según lo visto en la presentación. Mínimo para aprobar: ${PUNTAJE_APROBACION}%.`,
        passingScore: PUNTAJE_APROBACION,
        maxAttempts: INTENTOS,
        showResultsNow: true,
      },
    });

    for (const [i, p] of evaluacion.preguntas.entries()) {
      await prisma.question.create({
        data: {
          quizId: quiz.id,
          type: "SINGLE_CHOICE",
          statement: p.enunciado,
          area: c.categoria,
          score: 1,
          sortOrder: i,
          options: {
            create: p.opciones.map((o, j) => ({ text: o.texto, isCorrect: o.correcta, sortOrder: j })),
          },
        },
      });
    }
    const quien = await prisma.user.findUnique({ where: { id: responsable }, select: { fullName: true } });
    console.log(`  Evaluación: ${evaluacion.preguntas.length} preguntas · tutor: ${quien?.fullName ?? "—"}`);

    // ---- Enganche con el PIC -------------------------------------------
    if (!actividad) {
      console.log(`  ⚠ No se encontró la actividad «${c.actividadPIC}» en el PIC. El curso queda sin enganchar.`);
      continue;
    }
    await prisma.trainingActivity.update({ where: { id: actividad.id }, data: { courseId: curso.id } });
    console.log(`  PIC: ${actividad.area?.name ?? "sin área"} · trimestre ${actividad.quarters.join(", ")}`);
  }

  console.log("\n── Estado del plan institucional ──");
  // Solo el PIC: en la base conviven planes de prueba cuyas actividades
  // ensuciarían el conteo.
  const delPlan = { plan: { title: { contains: "Institucional" }, year: 2026 } };
  const total = await prisma.trainingActivity.count({ where: delPlan });
  const conCurso = await prisma.trainingActivity.count({ where: { ...delPlan, courseId: { not: null } } });
  console.log(`${conCurso} de ${total} capacitaciones con contenido montado.`);

  const porArea = await prisma.trainingArea.findMany({
    orderBy: { sortOrder: "asc" },
    select: {
      name: true,
      tutor: { select: { username: true } },
      activities: { where: delPlan, select: { courseId: true } },
    },
  });
  for (const a of porArea) {
    const listas = a.activities.filter((x) => x.courseId).length;
    console.log(
      `  ${String(listas).padStart(2)}/${String(a.activities.length).padEnd(2)}  ${a.name.slice(0, 44).padEnd(44)} @${a.tutor?.username ?? "sin tutor"}`
    );
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("FALLÓ:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
