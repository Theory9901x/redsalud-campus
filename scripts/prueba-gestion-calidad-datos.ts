import path from "node:path";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import React from "react";
import { Document, Page, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "../lib/prisma";
import { targetAudienceUserWhere } from "../lib/training-plans";
import { generarCodigoEncuesta, generarSlug } from "../lib/encuestas/consultas";

/**
 * DATOS de la gestión de prueba de Calidad (scripts/prueba-gestion-calidad.ts
 * debe haber corrido antes): una jornada ya realizada (14-oct-2026) con
 * asistencia real por conexión, presaber y postsaber de personal e invitados,
 * dos documentos, una encuesta de satisfacción con respuestas y la jornada de
 * mañana. Con esto la ficha completa, la evaluación, la asistencia, la
 * encuesta y el informe PDF muestran la gestión de punta a punta.
 *
 * Usa hasta 8 personas asistenciales REALES de la audiencia (quedan con una
 * inscripción al curso [PRUEBA] y registros marcados [PRUEBA]); `--limpiar`
 * borra todo lo que creó esta prueba (plan, curso, encuesta y sus registros).
 *
 *   npx tsx --env-file=.env scripts/prueba-gestion-calidad-datos.ts
 *   npx tsx --env-file=.env scripts/prueba-gestion-calidad-datos.ts --limpiar
 */
const TITULO_PLAN = "[PRUEBA] Gestión de capacitación · Calidad";
const TITULO_ENCUESTA = "[PRUEBA] Satisfacción · Higiene de manos";
const DIA = "2026-10-14";
const hora = (hhmm: string) => new Date(`${DIA}T${hhmm}:00-05:00`);

const EXTERNOS = [
  ["Diana Patricia Rojas", "IPS Yopal · Enfermería"],
  ["Carlos Andrés Mejía", "Hospital de Aguazul"],
  ["Luz Marina Pérez", "IPS Paz de Ariporo"],
  ["Jhon Fredy Sánchez", "IPS Villanueva"],
  ["Angélica Torres", "Hospital de Tauramena"],
  ["Mauricio Díaz", "IPS Monterrey"],
];

async function pdf(titulo: string, lineas: string[]) {
  const h = React.createElement;
  const doc = h(
    Document,
    null,
    h(
      Page,
      { size: "A4", style: { padding: 40, fontSize: 11, fontFamily: "Helvetica" } },
      h(Text, { style: { fontSize: 18, fontWeight: 700, marginBottom: 6 } }, titulo),
      h(Text, { style: { fontSize: 9, color: "#5B7184", marginBottom: 18 } }, "Red Salud Casanare E.S.E. · Área de Calidad · Programa IAAS - PROA - PMMHM · Documento de prueba"),
      ...lineas.map((l, i) => h(View, { key: i, style: { marginBottom: 6 } }, h(Text, null, l)))
    )
  );
  return renderToBuffer(doc as never);
}

async function limpiar() {
  const plan = await prisma.trainingPlan.findFirst({ where: { title: TITULO_PLAN }, select: { id: true, activities: { select: { id: true, courseId: true } } } });
  const courseIds = [...new Set((plan?.activities ?? []).map((a) => a.courseId).filter((c): c is string => !!c))];
  await prisma.survey.deleteMany({ where: { title: TITULO_ENCUESTA } });
  if (plan) await prisma.trainingPlan.delete({ where: { id: plan.id } });
  if (courseIds.length) await prisma.course.deleteMany({ where: { id: { in: courseIds } } });
  await prisma.media.deleteMany({ where: { folder: { in: (plan?.activities ?? []).map((a) => `training-activities/${a.id}`) } } });
  console.log("Gestión de prueba de Calidad eliminada.");
}

async function main() {
  if (process.argv.includes("--limpiar")) return limpiar();
  const plan = await prisma.trainingPlan.findFirstOrThrow({
    where: { title: TITULO_PLAN },
    select: { id: true, tutorId: true, targetDepartment: true, activities: { select: { id: true, courseId: true, targetAudience: true, responsibleUserId: true } } },
  });
  const act = plan.activities[0];
  if (!act?.courseId) throw new Error("La actividad de prueba no tiene curso.");
  if (await prisma.trainingAttendance.count({ where: { activityId: act.id } })) {
    console.log("Los datos de prueba ya existen: no se hace nada.");
    return;
  }
  const quiz = await prisma.quiz.findFirstOrThrow({
    where: { courseId: act.courseId, moduleId: null },
    select: { id: true, passingScore: true, questions: { orderBy: { sortOrder: "asc" }, select: { id: true, options: { select: { id: true, isCorrect: true } } } } },
  });
  const tutorId = plan.tutorId;

  // Jornada ya realizada (la de mañana ya existe).
  await prisma.trainingSession.create({
    data: { activityId: act.id, startsAt: hora("09:00"), endsAt: hora("10:00"), modality: "VIRTUAL", status: "CLOSED", meetingUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/sala/${act.id}`, facilitador: "Profesional líder IAAS - PROA" },
  });

  const personas = await prisma.user.findMany({
    where: { ...targetAudienceUserWhere(plan.targetDepartment, act.targetAudience), NOT: { fullName: { startsWith: "[DEMO]" } } },
    orderBy: { fullName: "asc" },
    take: 8,
    select: { id: true, fullName: true },
  });
  if (personas.length === 0) throw new Error("No hay personal asistencial en la audiencia.");

  // Respuestas de un intento: `aciertos` preguntas bien, el resto mal.
  const responder = (aciertos: number) =>
    quiz.questions.map((q, i) => {
      const correcta = q.options.find((o) => o.isCorrect)!;
      const otra = q.options.find((o) => !o.isCorrect) ?? correcta;
      const bien = i < aciertos;
      return { questionId: q.id, selectedOptionIds: [bien ? correcta.id : otra.id], isCorrect: bien, scoreObtained: bien ? 1 : 0 };
    });
  const puntaje = (aciertos: number) => Math.round((aciertos / quiz.questions.length) * 100);
  const n = quiz.questions.length;

  for (const [i, p] of personas.entries()) {
    const pre = Math.max(1, Math.min(n - 1, 2 + (i % 3))); // 2–4 de 6
    const post = Math.min(n, pre + 3); // mejora 3 preguntas: la mayoría aprueba
    const presentaPost = i < personas.length - 2; // dos personas sin postsaber todavía
    const completo = presentaPost && puntaje(post) >= quiz.passingScore;
    const ins = await prisma.enrollment.create({
      data: {
        userId: p.id,
        courseId: act.courseId,
        status: completo ? "COMPLETED" : "ACTIVE",
        enrolledAt: hora("08:55"),
        startedAt: hora("08:55"),
        completedAt: completo ? hora(`09:${40 + i}`) : null,
        progressPercentage: completo ? 100 : 60,
        finalScore: completo ? puntaje(post) : null,
      },
      select: { id: true },
    });
    await prisma.trainingAttendance.create({
      data: { activityId: act.id, userId: p.id, attended: true, source: "AUTOMATIC", registeredAt: hora(`09:0${Math.min(9, i)}`), trimestre: 4 },
    });
    const entra = hora(`09:0${Math.min(9, i)}`);
    const sale = new Date(entra.getTime() + (38 + i * 3) * 60_000);
    await prisma.callConnectionLog.create({
      data: { activityId: act.id, userId: p.id, displayName: p.fullName, joinedAt: entra, leftAt: sale, durationSeconds: Math.round((sale.getTime() - entra.getTime()) / 1000), createdAt: sale },
    });
    await prisma.quizAttempt.create({
      data: { userId: p.id, quizId: quiz.id, enrollmentId: ins.id, attemptNumber: 1, moment: "PRESABER", score: puntaje(pre), passed: puntaje(pre) >= quiz.passingScore, startedAt: hora("08:56"), finishedAt: hora("09:02"), answers: { create: responder(pre) } },
    });
    if (presentaPost) {
      await prisma.quizAttempt.create({
        data: { userId: p.id, quizId: quiz.id, enrollmentId: ins.id, attemptNumber: 2, moment: "POSTSABER", score: puntaje(post), passed: puntaje(post) >= quiz.passingScore, startedAt: hora("09:48"), finishedAt: hora(`09:${52 + (i % 6)}`), answers: { create: responder(post) } },
      });
    }
  }

  for (const [i, [nombre, entidad]] of EXTERNOS.entries()) {
    const ext = await prisma.externalParticipant.create({ data: { activityId: act.id, fullName: nombre, company: entidad, createdAt: hora(`09:${10 + i}`) }, select: { id: true } });
    const pre = 2 + (i % 3);
    const post = Math.min(n, pre + 2);
    await prisma.externalAttempt.create({ data: { participantId: ext.id, moment: "PRESABER", score: puntaje(pre), passed: puntaje(pre) >= quiz.passingScore, createdAt: hora(`09:${12 + i}`) } });
    if (i < EXTERNOS.length - 1) {
      await prisma.externalAttempt.create({ data: { participantId: ext.id, moment: "POSTSABER", score: puntaje(post), passed: puntaje(post) >= quiz.passingScore, createdAt: hora(`09:${54 + (i % 5)}`) } });
    }
    const entra = hora(`09:${10 + i}`);
    const sale = new Date(entra.getTime() + (30 + i * 4) * 60_000);
    await prisma.callConnectionLog.create({
      data: { activityId: act.id, externalParticipantId: ext.id, displayName: `${nombre} (${entidad})`, joinedAt: entra, leftAt: sale, durationSeconds: Math.round((sale.getTime() - entra.getTime()) / 1000), createdAt: sale },
    });
  }

  // Documentos de la jornada.
  const folder = `training-activities/${act.id}`;
  await mkdir(path.join(process.cwd(), "uploads", folder), { recursive: true });
  const docs: [string, string[]][] = [
    ["Presentacion-Higiene-de-manos-5-momentos.pdf", ["1. Por qué importa la higiene de manos en la prevención de las IAAS.", "2. Los 5 momentos de la OMS.", "3. Técnica: fricción con alcohol (20–30 s) y lavado con agua y jabón (40–60 s).", "4. Los guantes no reemplazan la higiene de manos.", "5. Indicadores de adherencia y seguimiento en los servicios."]],
    ["Lista-de-asistencia-firmada-14-oct-2026.pdf", ["Jornada virtual · 14 de octubre de 2026 · 9:00 a. m.", ...personas.map((p, i) => `${i + 1}. ${p.fullName} — asistió (conexión a la sala)`), ...EXTERNOS.map(([nom, ent], i) => `${personas.length + i + 1}. ${nom} — ${ent} (invitado)`), "", "Firma del responsable: ______________________"]],
  ];
  for (const [nombre, lineas] of docs) {
    const buffer = await pdf(nombre.replace(/-/g, " ").replace(/\.pdf$/, ""), lineas);
    await writeFile(path.join(process.cwd(), "uploads", folder, nombre), buffer);
    const id = randomUUID();
    await prisma.media.create({ data: { id, fileName: nombre, fileType: "application/pdf", fileSize: buffer.byteLength, folder, fileUrl: `/api/media/${id}`, uploadedBy: tutorId, trainingActivityId: act.id, createdAt: hora("10:20") } });
  }

  // Encuesta de satisfacción de la jornada, con respuestas del personal.
  const escala = { escalaMin: 1, escalaMax: 5, escalaEstilo: "numeros", etiquetaMin: "Muy en desacuerdo", etiquetaMax: "Totalmente de acuerdo" };
  const encuesta = await prisma.survey.create({
    data: {
      code: await generarCodigoEncuesta(),
      slug: generarSlug(),
      title: TITULO_ENCUESTA,
      description: "Cuéntanos cómo te pareció la jornada de higiene de manos. Toma menos de 2 minutos.",
      themeColor: "#1E88E5",
      estimatedMinutes: 2,
      audience: "INTERNO",
      status: "PUBLISHED",
      publishedAt: hora("10:05"),
      trainingPlanId: plan.id,
      trainingActivityId: act.id,
      targetAudience: act.targetAudience,
      requireLogin: true,
      createdBy: tutorId,
      pages: {
        create: {
          sortOrder: 0,
          title: "Satisfacción con la jornada",
          questions: {
            create: [
              { sortOrder: 0, type: "SCALE", prompt: "El contenido fue claro y aplicable a mi trabajo.", config: escala },
              { sortOrder: 1, type: "SCALE", prompt: "El facilitador dominó el tema y resolvió las dudas.", config: escala },
              { sortOrder: 2, type: "SCALE", prompt: "La duración y la modalidad virtual fueron adecuadas.", config: escala },
              {
                sortOrder: 3,
                type: "SINGLE_CHOICE",
                prompt: "¿Cómo calificas la jornada en general?",
                config: { opciones: [{ id: "exc", texto: "Excelente", tono: "exc" }, { id: "bue", texto: "Buena", tono: "bue" }, { id: "reg", texto: "Regular", tono: "reg" }, { id: "mal", texto: "Mala", tono: "mal" }] },
              },
              { sortOrder: 4, type: "LONG_TEXT", prompt: "¿Qué mejorarías para la próxima jornada?", isRequired: false },
            ],
          },
        },
      },
    },
    select: { id: true, pages: { select: { questions: { orderBy: { sortOrder: "asc" }, select: { id: true, type: true } } } } },
  });
  const preguntas = encuesta.pages[0].questions;
  const comentarios = ["Más casos prácticos del servicio.", "Compartir la presentación antes de la jornada.", "Hacerla presencial en cada IPS una vez al año.", null, "Muy clara, gracias.", null, "Incluir el video de la técnica.", null];
  const generales = ["exc", "exc", "bue", "exc", "bue", "exc", "reg", "bue"];
  for (const [i, p] of personas.entries()) {
    const valores = [5, 4, 5, 4, 5, 5, 3, 4];
    await prisma.surveyResponse.create({
      data: {
        surveyId: encuesta.id,
        userId: p.id,
        completed: true,
        startedAt: hora(`10:${10 + i}`),
        submittedAt: hora(`10:${12 + i}`),
        channel: "plataforma",
        answers: {
          create: [
            { questionId: preguntas[0].id, value: { tipo: "escala", valor: valores[i % 8] } },
            { questionId: preguntas[1].id, value: { tipo: "escala", valor: Math.min(5, valores[(i + 1) % 8]) } },
            { questionId: preguntas[2].id, value: { tipo: "escala", valor: Math.max(3, valores[(i + 2) % 8] - 1) } },
            { questionId: preguntas[3].id, value: { tipo: "opcion", opcionId: generales[i % 8] } },
            ...(comentarios[i % 8] ? [{ questionId: preguntas[4].id, value: { tipo: "texto", texto: comentarios[i % 8]! }, textValue: comentarios[i % 8]! }] : []),
          ],
        },
      },
    });
  }

  await prisma.trainingActivity.update({
    where: { id: act.id },
    data: { expectedAttendeesNote: "Personal asistencial de las IPS de la red", expectedAttendees: 264 },
  });

  console.log(`Listo: ${personas.length} personas (${personas.map((p) => p.fullName).join(", ")}), ${EXTERNOS.length} invitados, 2 documentos, encuesta con ${personas.length} respuestas.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
