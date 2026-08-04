"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { momentoParaPersona, cicloEsAutomatico } from "@/lib/presaber-postsaber";

/**
 * Acciones del ACCESO EXTERNO (/invitado): gente de fuera de la entidad que
 * por decisión institucional NO tiene cuenta en la plataforma. Su identidad
 * es el registro breve (nombre + empresa) guardado en ExternalParticipant y
 * recordado con una cookie httpOnly cuyo valor es el id (un cuid
 * impredecible: funciona como llave al portador de SU registro, no del de
 * nadie más). Nada de esto toca las tablas de usuarios internos.
 */

const COOKIE_PREFIJO = "invitado_";

export type RegistroInvitadoState = { error: string | null };

export async function registrarInvitadoAction(
  activityId: string,
  _prev: RegistroInvitadoState,
  formData: FormData
): Promise<RegistroInvitadoState> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const company = String(formData.get("company") ?? "").trim();

  if (fullName.length < 5) return { error: "Escribe tu nombre completo." };
  if (company.length < 2) return { error: "Escribe la empresa o entidad de la que vienes." };

  const actividad = await prisma.trainingActivity.findUnique({
    where: { id: activityId },
    select: { id: true, status: true },
  });
  if (!actividad) return { error: "Esta capacitación no existe." };
  if (actividad.status === "CLOSED") return { error: "Esta jornada ya fue cerrada por el área." };

  const participante = await prisma.externalParticipant.create({
    data: { activityId, fullName, company },
    select: { id: true },
  });

  const jar = await cookies();
  jar.set(`${COOKIE_PREFIJO}${activityId}`, participante.id, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });

  revalidatePath(`/invitado/${activityId}`);
  return { error: null };
}

/** Participante externo de ESTA actividad según la cookie; null si no hay registro válido. */
export async function getParticipanteDeCookie(activityId: string) {
  const jar = await cookies();
  const id = jar.get(`${COOKIE_PREFIJO}${activityId}`)?.value;
  if (!id) return null;
  const participante = await prisma.externalParticipant.findUnique({
    where: { id },
    select: { id: true, fullName: true, company: true, activityId: true, attempts: { select: { moment: true, score: true, passed: true } } },
  });
  if (!participante || participante.activityId !== activityId) return null;
  return participante;
}

export type EvaluacionExternaState = {
  error: string | null;
  resultado?: { score: number; passed: boolean; passingScore: number };
};

export async function presentarEvaluacionExternaAction(
  activityId: string,
  _prev: EvaluacionExternaState,
  formData: FormData
): Promise<EvaluacionExternaState> {
  const participante = await getParticipanteDeCookie(activityId);
  if (!participante) return { error: "Tu registro no se encontró. Vuelve a ingresar desde el enlace de la jornada." };

  const actividad = await prisma.trainingActivity.findUnique({
    where: { id: activityId },
    select: {
      status: true,
      courseId: true,
      presaberOpenedAt: true,
      presaberClosedAt: true,
      postsaberOpenedAt: true,
      postsaberClosedAt: true,
    },
  });
  if (!actividad?.courseId) return { error: "Esta capacitación no tiene evaluación disponible." };

  // Mismas reglas que el personal interno: ciclo automático por persona
  // (presaber primero; postsaber al presentarlo) o ventanas manuales del
  // área. Jornada cerrada = ciclo congelado también para externos.
  if (cicloEsAutomatico(actividad) && actividad.status === "CLOSED") {
    return { error: "Esta jornada ya fue cerrada por el área." };
  }
  const prePresentado = participante.attempts.some((a) => a.moment === "PRESABER");
  const momento = momentoParaPersona(actividad, prePresentado);
  if (!momento) return { error: "La evaluación no está habilitada en este momento." };

  const yaPresentado = await prisma.externalAttempt.findUnique({
    where: { participantId_moment: { participantId: participante.id, moment: momento } },
    select: { id: true },
  });
  if (yaPresentado) return { error: "Ya presentaste esta evaluación: los invitados tienen un único intento por momento." };

  const quiz = await prisma.quiz.findFirst({
    where: { courseId: actividad.courseId, moduleId: null, isActive: true },
    select: {
      id: true,
      passingScore: true,
      questions: {
        where: { isActive: true, type: { not: "OPEN_TEXT" } },
        select: { id: true, type: true, score: true, options: { select: { id: true, isCorrect: true } } },
      },
    },
  });
  if (!quiz || quiz.questions.length === 0) return { error: "Esta capacitación no tiene evaluación disponible." };

  // Calificación automática: mismas reglas que la evaluación interna para
  // selección única y múltiple (la múltiple exige el conjunto EXACTO).
  let puntosObtenidos = 0;
  let puntosTotales = 0;
  const seleccion: Record<string, string[]> = {};
  for (const q of quiz.questions) {
    puntosTotales += q.score;
    const marcadas = formData.getAll(`q_${q.id}`).map(String).filter(Boolean);
    seleccion[q.id] = marcadas;
    const correctas = q.options.filter((o) => o.isCorrect).map((o) => o.id);
    const esCorrecta =
      q.type === "MULTIPLE_CHOICE"
        ? marcadas.length === correctas.length && correctas.every((c) => marcadas.includes(c))
        : marcadas.length === 1 && correctas.includes(marcadas[0]);
    if (esCorrecta) puntosObtenidos += q.score;
  }

  const score = puntosTotales > 0 ? Math.round((puntosObtenidos / puntosTotales) * 100) : 0;
  const passed = score >= quiz.passingScore;

  await prisma.externalAttempt.create({
    data: { participantId: participante.id, moment: momento, score, passed, answers: seleccion },
  });

  // Sin revalidatePath aquí: revalidar re-renderiza la página de la
  // evaluación, que al ver el intento ya creado redirige al hub ANTES de que
  // el cliente alcance a mostrar la tarjeta de resultado. El hub es dinámico
  // y se refresca solo al navegar de vuelta.
  return { error: null, resultado: { score, passed, passingScore: quiz.passingScore } };
}
