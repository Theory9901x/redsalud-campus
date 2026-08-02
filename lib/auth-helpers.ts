import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("No autorizado: se requiere rol ADMIN.");
  }
  return session;
}

export async function requireTutorOrAdmin() {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "TUTOR")) {
    throw new Error("No autorizado: se requiere rol TUTOR o ADMIN.");
  }
  return session;
}

/** Verifica que el usuario sea ADMIN, o TUTOR dueño del curso. Lanza si no cumple. */
export async function requireCourseAccess(courseId: string) {
  const session = await requireTutorOrAdmin();
  if (session.user.role === "ADMIN") return session;

  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { tutorId: true } });
  if (!course || course.tutorId !== session.user.id) {
    throw new Error("No autorizado: no eres el tutor de este curso.");
  }
  return session;
}

/** Verifica que el usuario sea ADMIN, o TUTOR responsable del plan. Lanza si no cumple. */
export async function requireTrainingPlanAccess(planId: string) {
  const session = await requireTutorOrAdmin();
  if (session.user.role === "ADMIN") return session;

  const plan = await prisma.trainingPlan.findUnique({ where: { id: planId }, select: { tutorId: true } });
  if (!plan || plan.tutorId !== session.user.id) {
    throw new Error("No autorizado: no eres el tutor responsable de este plan.");
  }
  return session;
}

/**
 * CONSULTA del plan: además del responsable del plan, lo puede ver el tutor
 * de cualquier área que tenga capacitaciones dentro.
 *
 * Es más amplio que requireTrainingPlanAccess a propósito. El plan
 * institucional lo administra Talento Humano, pero cada área responde por su
 * parte y necesita abrirlo para saber qué le toca. Ver no es editar: quién
 * puede modificar el plan sigue decidiéndolo requireTrainingPlanAccess.
 */
export async function requireTrainingPlanRead(planId: string) {
  const session = await requireTutorOrAdmin();
  if (session.user.role === "ADMIN") return session;

  const plan = await prisma.trainingPlan.findUnique({
    where: { id: planId },
    select: {
      tutorId: true,
      _count: { select: { activities: { where: { area: { tutorId: session.user.id } } } } },
    },
  });
  if (!plan || (plan.tutorId !== session.user.id && plan._count.activities === 0)) {
    throw new Error("No autorizado: este plan no te corresponde.");
  }
  return session;
}

/**
 * Acceso a UNA capacitación: el responsable del plan, o el tutor del área a
 * la que pertenece.
 *
 * Que el área pueda entrar aquí es el punto de darle cuenta propia: es donde
 * sube su presentación, registra la asistencia y cierra su jornada. El
 * alcance queda acotado a lo suyo, no al plan entero.
 */
export async function requireTrainingActivityAccess(activityId: string) {
  const activity = await prisma.trainingActivity.findUnique({
    where: { id: activityId },
    select: { planId: true, area: { select: { tutorId: true } } },
  });
  if (!activity) {
    throw new Error("Actividad no encontrada.");
  }

  const session = await requireTutorOrAdmin();
  if (session.user.role === "ADMIN" || activity.area?.tutorId === session.user.id) {
    return { session, planId: activity.planId };
  }

  await requireTrainingPlanAccess(activity.planId);
  return { session, planId: activity.planId };
}

/** Igual que requireTrainingPlanAccess, resolviendo primero el plan dueño de la encuesta (Etapa 4). */
export async function requireSurveyAccess(surveyId: string) {
  const survey = await prisma.survey.findUnique({ where: { id: surveyId }, select: { trainingPlanId: true } });
  if (!survey) {
    throw new Error("Encuesta no encontrada.");
  }
  const session = await requireTrainingPlanAccess(survey.trainingPlanId);
  return { session, planId: survey.trainingPlanId };
}
