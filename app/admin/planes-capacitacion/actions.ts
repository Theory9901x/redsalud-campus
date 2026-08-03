"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTutorOrAdmin, requireTrainingPlanAccess, requireTrainingActivityAccess } from "@/lib/auth-helpers";
import { saveTrainingPlanDocument, saveTrainingActivityDocument } from "@/lib/storage";
import { trainingPlanSchema, trainingActivitySchema, trainingSessionSchema } from "@/lib/validations/training-plan";
import { estadoPresaber, estadoPostsaber, puedeHabilitarPostsaber } from "@/lib/presaber-postsaber";
import { getLinkableCoursesForUser } from "@/lib/training-plans";
import { parseTrainingScheduleFile, type ImportRowError } from "@/lib/training-plan-import";
import { registrarAuditoria } from "@/lib/audit";

export type TrainingPlanFormState = { error: string | null };
export type TrainingActivityFormState = { error: string | null };
export type TrainingDocumentFormState = { error: string | null };
export type BulkImportFormState = { error: string | null; createdCount?: number; rowErrors?: ImportRowError[] };


/**
 * Un plan CERRADO es de solo consulta: ninguna acción de mutación pasa de
 * aquí. Devuelve el mensaje de error o null si el plan sigue abierto. Vive
 * en un solo lugar para que ninguna acción nueva se le olvide el candado.
 */
async function errorSiPlanCerrado(planId: string): Promise<string | null> {
  const plan = await prisma.trainingPlan.findUnique({ where: { id: planId }, select: { status: true } });
  return plan?.status === "CLOSED"
    ? "El plan está cerrado: se puede consultar y exportar, pero no modificar. Un administrador puede reabrirlo."
    : null;
}

export async function createTrainingPlanAction(
  basePath: string,
  _prevState: TrainingPlanFormState,
  formData: FormData
): Promise<TrainingPlanFormState> {
  const session = await requireTutorOrAdmin();

  // Un plan de capacitación es un documento institucional: lo crea el
  // administrador. Las áreas gestionan lo adscrito a ellas dentro del plan,
  // no inventan planes nuevos.
  if (session.user.role !== "ADMIN") {
    return { error: "Solo un administrador puede crear planes de capacitación." };
  }

  const parsed = trainingPlanSchema.safeParse({
    title: formData.get("title"),
    year: formData.get("year"),
    description: formData.get("description") ?? "",
    targetDepartment: formData.get("targetDepartment"),
    tutorId: formData.get("tutorId") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const data = parsed.data;
  if (session.user.role === "ADMIN" && !data.tutorId) {
    return { error: "Selecciona un tutor responsable." };
  }
  // El tutor se autoasigna; el admin elige a qué tutor queda asignado.
  const tutorId = session.user.role === "ADMIN" ? data.tutorId! : session.user.id;

  const plan = await prisma.trainingPlan.create({
    data: {
      title: data.title,
      year: data.year,
      description: data.description || null,
      targetDepartment: data.targetDepartment || null,
      tutorId,
    },
  });

  revalidatePath(basePath);
  redirect(`${basePath}/${plan.id}`);
}

export async function createTrainingActivityAction(
  basePath: string,
  planId: string,
  _prevState: TrainingActivityFormState,
  formData: FormData
): Promise<TrainingActivityFormState> {
  await requireTrainingPlanAccess(planId);

  const cerrado = await errorSiPlanCerrado(planId);
  if (cerrado) return { error: cerrado };

  const parsed = trainingActivitySchema.safeParse({
    title: formData.get("title"),
    type: formData.get("type"),
    courseId: formData.get("courseId") ?? "",
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate") ?? "",
    targetAudience: formData.get("targetAudience"),
    isRequired: formData.get("isRequired") === "on" || formData.get("isRequired") === "true",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const data = parsed.data;

  await prisma.trainingActivity.create({
    data: {
      planId,
      title: data.title,
      type: data.type,
      courseId: data.type === "COURSE" ? data.courseId || null : null,
      startDate: new Date(data.startDate),
      endDate: data.endDate ? new Date(data.endDate) : null,
      targetAudience: data.targetAudience,
      isRequired: data.isRequired,
    },
  });

  revalidatePath(`${basePath}/${planId}`);
  return { error: null };
}

/** Etapa de reorganización: cronograma en bloque desde Excel/XLS. Complementa "Agregar actividad", no lo reemplaza. */
export async function bulkImportActivitiesAction(
  basePath: string,
  planId: string,
  _prevState: BulkImportFormState,
  formData: FormData
): Promise<BulkImportFormState> {
  await requireTrainingPlanAccess(planId);

  const cerrado = await errorSiPlanCerrado(planId);
  if (cerrado) return { error: cerrado };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Selecciona un archivo .xlsx." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let parsed;
  try {
    parsed = await parseTrainingScheduleFile(buffer);
  } catch {
    return { error: "No se pudo leer el archivo. Verifica que sea un .xlsx válido, generado con la plantilla." };
  }

  if (parsed.valid.length > 0) {
    await prisma.trainingActivity.createMany({
      data: parsed.valid.map((row) => ({
        planId,
        title: row.title,
        type: row.type,
        courseId: row.courseId,
        startDate: row.startDate,
        endDate: row.endDate,
        targetAudience: row.targetAudience,
        isRequired: row.isRequired,
      })),
    });
  }

  revalidatePath(`${basePath}/${planId}`);
  return { error: null, createdCount: parsed.valid.length, rowErrors: parsed.errors };
}

export async function uploadTrainingPlanDocumentAction(
  basePath: string,
  planId: string,
  _prevState: TrainingDocumentFormState,
  formData: FormData
): Promise<TrainingDocumentFormState> {
  const session = await requireTrainingPlanAccess(planId);

  const cerrado = await errorSiPlanCerrado(planId);
  if (cerrado) return { error: cerrado };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Selecciona un archivo." };
  }

  await saveTrainingPlanDocument(file, planId, session.user.id);

  revalidatePath(`${basePath}/${planId}`);
  return { error: null };
}

export async function uploadTrainingActivityDocumentAction(
  basePath: string,
  planId: string,
  activityId: string,
  _prevState: TrainingDocumentFormState,
  formData: FormData
): Promise<TrainingDocumentFormState> {
  const { session } = await requireTrainingActivityAccess(activityId);

  const cerrado = await errorSiPlanCerrado(planId);
  if (cerrado) return { error: cerrado };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Selecciona un archivo." };
  }

  await saveTrainingActivityDocument(file, activityId, session.user.id);

  revalidatePath(`${basePath}/${planId}/actividades/${activityId}`);
  return { error: null };
}

/** Etapa 3: registro manual de asistencia, solo aplica a actividades sin curso vinculado. */
export async function setAttendanceAction(activityId: string, userId: string, attended: boolean) {
  const { session, planId } = await requireTrainingActivityAccess(activityId);

  const cerrado = await errorSiPlanCerrado(planId);
  if (cerrado) throw new Error(cerrado);

  const activity = await prisma.trainingActivity.findUniqueOrThrow({ where: { id: activityId }, select: { status: true } });
  if (activity.status === "CLOSED") {
    throw new Error("La jornada ya cerró: la participación está congelada y no admite más cambios.");
  }

  await prisma.trainingAttendance.upsert({
    where: { activityId_userId: { activityId, userId } },
    update: { attended, registeredBy: session.user.id, registeredAt: new Date() },
    create: { activityId, userId, attended, registeredBy: session.user.id },
  });

  revalidatePath(`/admin/planes-capacitacion/${planId}/actividades/${activityId}`);
  revalidatePath(`/tutor/planes-capacitacion/${planId}/actividades/${activityId}`);
}

/**
 * Etapa 6: ciclo de vida de la jornada. Habilitar = pasar de BORRADOR a
 * ABIERTA (visible a los estudiantes del área, admite respuestas). Cerrar es
 * manual y explícito: desde ese momento la participación queda congelada y
 * los indicadores son definitivos. No hay reapertura: cerrado es terminal.
 */
export async function enableActivityAction(basePath: string, planId: string, activityId: string) {
  await requireTrainingActivityAccess(activityId);

  const cerrado = await errorSiPlanCerrado(planId);
  if (cerrado) throw new Error(cerrado);

  const activity = await prisma.trainingActivity.findUniqueOrThrow({ where: { id: activityId }, select: { status: true } });
  if (activity.status !== "DRAFT") {
    throw new Error("Solo se puede habilitar una jornada que está en borrador.");
  }

  await prisma.trainingActivity.update({ where: { id: activityId }, data: { status: "OPEN", enabledAt: new Date() } });

  revalidatePath(`${basePath}/${planId}`);
  revalidatePath(`${basePath}/${planId}/actividades/${activityId}`);
}

export async function closeActivityAction(basePath: string, planId: string, activityId: string) {
  await requireTrainingActivityAccess(activityId);

  const cerrado = await errorSiPlanCerrado(planId);
  if (cerrado) throw new Error(cerrado);

  const activity = await prisma.trainingActivity.findUniqueOrThrow({ where: { id: activityId }, select: { status: true } });
  if (activity.status !== "OPEN") {
    throw new Error("Solo se puede cerrar una jornada que está abierta.");
  }

  await prisma.trainingActivity.update({ where: { id: activityId }, data: { status: "CLOSED", closedAt: new Date() } });

  revalidatePath(`${basePath}/${planId}`);
  revalidatePath(`${basePath}/${planId}/actividades/${activityId}`);
}

export type LinkCourseState = { error: string | null };

/**
 * Engancha una capacitación del plan al curso que la desarrolla.
 *
 * Es lo que convierte "sin contenido todavía" en una capacitación completa:
 * hasta este punto un área podía subir su presentación y armar su evaluación
 * como curso, pero no había forma de decirle a SU línea del PIC cuál de sus
 * cursos era. Solo yo podía hacerlo, por script.
 *
 * No exige que el curso esté vacío de asignación: un curso ya puede tener
 * estudiantes inscritos por otra vía y de todas formas ser "el" contenido de
 * esta línea del plan.
 */
export async function linkCourseToActivityAction(
  basePath: string,
  planId: string,
  activityId: string,
  _prevState: LinkCourseState,
  formData: FormData
): Promise<LinkCourseState> {
  const { session } = await requireTrainingActivityAccess(activityId);

  const cerrado = await errorSiPlanCerrado(planId);
  if (cerrado) return { error: cerrado };

  const courseId = String(formData.get("courseId") ?? "").trim();
  if (!courseId) return { error: "Elige un curso." };

  const opciones = await getLinkableCoursesForUser(session.user.role, session.user.id);
  if (!opciones.some((c) => c.id === courseId)) {
    return { error: "Ese curso no está disponible para vincular." };
  }

  await prisma.trainingActivity.update({ where: { id: activityId }, data: { courseId } });

  revalidatePath(`${basePath}/${planId}`);
  revalidatePath(`${basePath}/${planId}/actividades/${activityId}`);
  return { error: null };
}

/** Deshace el enganche: la capacitación vuelve a "sin contenido todavía". */
export async function unlinkCourseFromActivityAction(
  basePath: string,
  planId: string,
  activityId: string
): Promise<{ error: string | null }> {
  await requireTrainingActivityAccess(activityId);

  const cerrado = await errorSiPlanCerrado(planId);
  if (cerrado) return { error: cerrado };
  await prisma.trainingActivity.update({ where: { id: activityId }, data: { courseId: null } });
  revalidatePath(`${basePath}/${planId}`);
  revalidatePath(`${basePath}/${planId}/actividades/${activityId}`);
  return { error: null };
}

export type DeleteState = { error: string | null };

/**
 * Edita un plan de capacitación. Solo cambia sus datos: las actividades,
 * asistencias y encuestas quedan intactas.
 */
export async function updateTrainingPlanAction(
  basePath: string,
  planId: string,
  _prevState: TrainingPlanFormState,
  formData: FormData
): Promise<TrainingPlanFormState> {
  const session = await requireTrainingPlanAccess(planId);

  const parsed = trainingPlanSchema.safeParse({
    title: formData.get("title"),
    year: formData.get("year"),
    description: formData.get("description") ?? "",
    targetDepartment: formData.get("targetDepartment"),
    tutorId: formData.get("tutorId") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const data = parsed.data;

  await prisma.trainingPlan.update({
    where: { id: planId },
    data: {
      title: data.title,
      year: data.year,
      description: data.description || null,
      targetDepartment: data.targetDepartment || null,
      // Solo el admin puede reasignar el plan a otro tutor.
      ...(session.user.role === "ADMIN" && data.tutorId ? { tutorId: data.tutorId } : {}),
    },
  });

  revalidatePath(basePath);
  revalidatePath(`${basePath}/${planId}`);
  return { error: null };
}

/**
 * Elimina un plan con todo lo que cuelga de él (actividades, asistencias,
 * encuestas y documentos). Se bloquea si alguna jornada ya registró
 * asistencia: eso es evidencia de capacitación y no debe desaparecer sin más.
 */
export async function deleteTrainingPlanAction(basePath: string, planId: string): Promise<DeleteState> {
  await requireTrainingPlanAccess(planId);

  const plan = await prisma.trainingPlan.findUnique({
    where: { id: planId },
    select: { title: true, activities: { select: { _count: { select: { attendances: true } } } } },
  });
  if (!plan) return { error: "El plan ya no existe." };

  const asistencias = plan.activities.reduce((s, a) => s + a._count.attendances, 0);
  if (asistencias > 0) {
    return {
      error: `No se puede eliminar "${plan.title}": tiene ${asistencias} registro(s) de asistencia, que son la evidencia de la capacitación.`,
    };
  }

  await prisma.trainingPlan.delete({ where: { id: planId } });
  revalidatePath(basePath);
  return { error: null };
}

/** Elimina una jornada del plan. Se bloquea si ya tiene asistencia registrada. */
export async function deleteTrainingActivityAction(
  basePath: string,
  planId: string,
  activityId: string
): Promise<DeleteState> {
  await requireTrainingActivityAccess(activityId);

  const cerrado = await errorSiPlanCerrado(planId);
  if (cerrado) return { error: cerrado };

  const activity = await prisma.trainingActivity.findUnique({
    where: { id: activityId },
    select: { title: true, _count: { select: { attendances: true } } },
  });
  if (!activity) return { error: "La jornada ya no existe." };

  if (activity._count.attendances > 0) {
    return {
      error: `No se puede eliminar "${activity.title}": ya tiene ${activity._count.attendances} asistencia(s) registrada(s).`,
    };
  }

  await prisma.trainingActivity.delete({ where: { id: activityId } });
  revalidatePath(`${basePath}/${planId}`);
  return { error: null };
}

// ------------------------------------------------------------------
// Jornadas: el día concreto en que se dicta una capacitación
// ------------------------------------------------------------------

export type TrainingSessionFormState = { error: string | null };

/**
 * Programa una jornada real para una capacitación del plan.
 *
 * Es lo que convierte "Trimestre II" en "12 de mayo, 8:00 a.m., virtual":
 * el plan dice CUÁNDO en términos generales, la jornada dice EXACTAMENTE
 * cuándo. Una misma capacitación puede tener varias -una por cada vez que
 * se dicta en el trimestre-, así que esto siempre agrega, nunca reemplaza.
 */
export async function createTrainingSessionAction(
  basePath: string,
  planId: string,
  activityId: string,
  _prevState: TrainingSessionFormState,
  formData: FormData
): Promise<TrainingSessionFormState> {
  await requireTrainingActivityAccess(activityId);

  const cerrado = await errorSiPlanCerrado(planId);
  if (cerrado) return { error: cerrado };

  const parsed = trainingSessionSchema.safeParse({
    startsAtDate: formData.get("startsAtDate"),
    startsAtTime: formData.get("startsAtTime"),
    endsAtTime: formData.get("endsAtTime") ?? "",
    shift: formData.get("shift") ?? "",
    modality: formData.get("modality"),
    location: formData.get("location") ?? "",
    meetingUrl: formData.get("meetingUrl") ?? "",
    capacity: formData.get("capacity") || "",
    municipioId: formData.get("municipioId") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const data = parsed.data;

  const startsAt = new Date(`${data.startsAtDate}T${data.startsAtTime}:00`);
  if (Number.isNaN(startsAt.getTime())) return { error: "Fecha u hora inválida." };

  const endsAt = data.endsAtTime ? new Date(`${data.startsAtDate}T${data.endsAtTime}:00`) : null;

  await prisma.trainingSession.create({
    data: {
      activityId,
      startsAt,
      endsAt,
      shift: data.shift || null,
      modality: data.modality,
      location: data.location || null,
      meetingUrl: data.meetingUrl || null,
      capacity: data.capacity ? Number(data.capacity) : null,
      municipioId: data.municipioId || null,
    },
  });

  revalidatePath(`${basePath}/${planId}`);
  revalidatePath(`${basePath}/${planId}/actividades/${activityId}`);
  return { error: null };
}

/** Ciclo de vida de la jornada, igual que el de la actividad: borrador -> abierta -> cerrada. */
export async function enableTrainingSessionAction(basePath: string, planId: string, activityId: string, sessionId: string) {
  await requireTrainingActivityAccess(activityId);

  const cerrado = await errorSiPlanCerrado(planId);
  if (cerrado) throw new Error(cerrado);
  await prisma.trainingSession.update({ where: { id: sessionId }, data: { status: "OPEN" } });
  revalidatePath(`${basePath}/${planId}/actividades/${activityId}`);
}

export async function closeTrainingSessionAction(basePath: string, planId: string, activityId: string, sessionId: string) {
  await requireTrainingActivityAccess(activityId);

  const cerrado = await errorSiPlanCerrado(planId);
  if (cerrado) throw new Error(cerrado);
  await prisma.trainingSession.update({ where: { id: sessionId }, data: { status: "CLOSED" } });
  revalidatePath(`${basePath}/${planId}/actividades/${activityId}`);
}

export async function deleteTrainingSessionAction(
  basePath: string,
  planId: string,
  activityId: string,
  sessionId: string
): Promise<DeleteState> {
  await requireTrainingActivityAccess(activityId);

  const cerrado = await errorSiPlanCerrado(planId);
  if (cerrado) return { error: cerrado };
  await prisma.trainingSession.delete({ where: { id: sessionId } });
  revalidatePath(`${basePath}/${planId}`);
  revalidatePath(`${basePath}/${planId}/actividades/${activityId}`);
  return { error: null };
}

// ------------------------------------------------------------------
// Ciclo presaber/postsaber: la misma evaluación, presentada dos veces
// ------------------------------------------------------------------

export type EvaluationCycleState = { error: string | null };

async function actividadConVentanas(activityId: string) {
  return prisma.trainingActivity.findUniqueOrThrow({
    where: { id: activityId },
    select: {
      courseId: true,
      presaberOpenedAt: true,
      presaberClosedAt: true,
      postsaberOpenedAt: true,
      postsaberClosedAt: true,
    },
  });
}

export async function openPresaberAction(
  basePath: string,
  planId: string,
  activityId: string
): Promise<EvaluationCycleState> {
  await requireTrainingActivityAccess(activityId);

  const cerrado = await errorSiPlanCerrado(planId);
  if (cerrado) return { error: cerrado };
  const actividad = await actividadConVentanas(activityId);

  if (!actividad.courseId) return { error: "Esta capacitación no tiene curso vinculado todavía." };
  if (estadoPresaber(actividad) !== "NO_CONFIGURADO") {
    return { error: "El presaber ya se habilitó antes." };
  }

  await prisma.trainingActivity.update({ where: { id: activityId }, data: { presaberOpenedAt: new Date() } });
  revalidatePath(`${basePath}/${planId}/actividades/${activityId}`);
  return { error: null };
}

export async function closePresaberAction(
  basePath: string,
  planId: string,
  activityId: string
): Promise<EvaluationCycleState> {
  await requireTrainingActivityAccess(activityId);

  const cerrado = await errorSiPlanCerrado(planId);
  if (cerrado) return { error: cerrado };
  const actividad = await actividadConVentanas(activityId);

  if (estadoPresaber(actividad) !== "DISPONIBLE") {
    return { error: "El presaber no está abierto." };
  }

  await prisma.trainingActivity.update({ where: { id: activityId }, data: { presaberClosedAt: new Date() } });
  revalidatePath(`${basePath}/${planId}/actividades/${activityId}`);
  return { error: null };
}

export async function openPostsaberAction(
  basePath: string,
  planId: string,
  activityId: string
): Promise<EvaluationCycleState> {
  await requireTrainingActivityAccess(activityId);

  const cerrado = await errorSiPlanCerrado(planId);
  if (cerrado) return { error: cerrado };
  const actividad = await actividadConVentanas(activityId);

  if (!puedeHabilitarPostsaber(actividad)) {
    return { error: "El postsaber se habilita después de cerrar el presaber, y solo una vez." };
  }

  await prisma.trainingActivity.update({ where: { id: activityId }, data: { postsaberOpenedAt: new Date() } });
  revalidatePath(`${basePath}/${planId}/actividades/${activityId}`);
  return { error: null };
}

export async function closePostsaberAction(
  basePath: string,
  planId: string,
  activityId: string
): Promise<EvaluationCycleState> {
  await requireTrainingActivityAccess(activityId);

  const cerrado = await errorSiPlanCerrado(planId);
  if (cerrado) return { error: cerrado };
  const actividad = await actividadConVentanas(activityId);

  if (estadoPostsaber(actividad) !== "DISPONIBLE") {
    return { error: "El postsaber no está abierto." };
  }

  await prisma.trainingActivity.update({ where: { id: activityId }, data: { postsaberClosedAt: new Date() } });
  revalidatePath(`${basePath}/${planId}/actividades/${activityId}`);
  return { error: null };
}

// ------------------------------------------------------------------
// Cierre del plan: la vigencia termina y el plan queda de solo consulta
// ------------------------------------------------------------------

export type ClosePlanState = { error: string | null };

/**
 * Qué impide cerrar el plan AHORA. Se calcula aparte de la acción para que
 * la página pueda mostrar los bloqueos antes de que alguien intente cerrar,
 * en vez de descubrirlos a punta de errores.
 */
export async function getPlanCloseBlockers(planId: string): Promise<string[]> {
  const actividades = await prisma.trainingActivity.findMany({
    where: { planId },
    select: {
      title: true,
      status: true,
      presaberOpenedAt: true,
      presaberClosedAt: true,
      postsaberOpenedAt: true,
      postsaberClosedAt: true,
      sessions: { where: { status: "OPEN" }, select: { id: true } },
    },
  });

  const bloqueos: string[] = [];
  const abiertas = actividades.filter((a) => a.status === "OPEN");
  if (abiertas.length > 0) {
    bloqueos.push(`${abiertas.length} ${abiertas.length === 1 ? "jornada abierta" : "jornadas abiertas"} sin cerrar.`);
  }
  const sesionesAbiertas = actividades.reduce((s, a) => s + a.sessions.length, 0);
  if (sesionesAbiertas > 0) {
    bloqueos.push(`${sesionesAbiertas} ${sesionesAbiertas === 1 ? "sesión agendada abierta" : "sesiones agendadas abiertas"}.`);
  }
  const ventanas = actividades.filter(
    (a) =>
      (a.presaberOpenedAt && !a.presaberClosedAt) || (a.postsaberOpenedAt && !a.postsaberClosedAt)
  );
  if (ventanas.length > 0) {
    bloqueos.push(
      `${ventanas.length} ${ventanas.length === 1 ? "evaluación con ventana abierta" : "evaluaciones con ventana abierta"} (presaber o postsaber sin cerrar).`
    );
  }
  return bloqueos;
}

/**
 * Cierra el plan. Solo el administrador o el responsable del plan -no las
 * áreas-, con observaciones obligatorias: el cierre de un plan institucional
 * es una decisión con constancia, no un clic.
 */
export async function closeTrainingPlanAction(
  basePath: string,
  planId: string,
  _prevState: ClosePlanState,
  formData: FormData
): Promise<ClosePlanState> {
  const session = await requireTrainingPlanAccess(planId);

  const plan = await prisma.trainingPlan.findUniqueOrThrow({ where: { id: planId }, select: { status: true, title: true } });
  if (plan.status === "CLOSED") return { error: "El plan ya está cerrado." };

  const bloqueos = await getPlanCloseBlockers(planId);
  if (bloqueos.length > 0) {
    return { error: `No se puede cerrar todavía: ${bloqueos.join(" ")}` };
  }

  const observaciones = String(formData.get("observaciones") ?? "").trim();
  if (observaciones.length < 10) {
    return { error: "Escribe las observaciones de cierre (mínimo 10 caracteres): son la constancia del acta." };
  }

  await prisma.trainingPlan.update({
    where: { id: planId },
    data: { status: "CLOSED", closedAt: new Date(), closedBy: session.user.id, closeObservations: observaciones },
  });

  await registrarAuditoria({
    userId: session.user.id,
    action: "UPDATE",
    entity: "TrainingPlan",
    entityId: planId,
    description: `Cerró el plan «${plan.title}». Observaciones: ${observaciones.slice(0, 180)}`,
  });

  revalidatePath(`${basePath}/${planId}`);
  revalidatePath(basePath);
  return { error: null };
}

/** Reabrir es permiso especial: SOLO administrador, y queda en la bitácora. */
export async function reopenTrainingPlanAction(basePath: string, planId: string): Promise<ClosePlanState> {
  const session = await requireTutorOrAdmin();
  if (session.user.role !== "ADMIN") {
    return { error: "Reabrir un plan cerrado requiere permiso de administrador." };
  }

  const plan = await prisma.trainingPlan.findUniqueOrThrow({ where: { id: planId }, select: { status: true, title: true } });
  if (plan.status !== "CLOSED") return { error: "El plan no está cerrado." };

  await prisma.trainingPlan.update({
    where: { id: planId },
    data: { status: "ACTIVE", closedAt: null, closedBy: null, closeObservations: null },
  });

  await registrarAuditoria({
    userId: session.user.id,
    action: "UPDATE",
    entity: "TrainingPlan",
    entityId: planId,
    description: `Reabrió el plan «${plan.title}» (permiso especial de administrador).`,
  });

  revalidatePath(`${basePath}/${planId}`);
  revalidatePath(basePath);
  return { error: null };
}
