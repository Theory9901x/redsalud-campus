"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTutorOrAdmin, requireTrainingPlanAccess, requireTrainingActivityAccess } from "@/lib/auth-helpers";
import { saveTrainingPlanDocument, saveTrainingActivityDocument } from "@/lib/storage";
import { trainingPlanSchema, trainingActivitySchema } from "@/lib/validations/training-plan";
import { parseTrainingScheduleFile, type ImportRowError } from "@/lib/training-plan-import";

export type TrainingPlanFormState = { error: string | null };
export type TrainingActivityFormState = { error: string | null };
export type TrainingDocumentFormState = { error: string | null };
export type BulkImportFormState = { error: string | null; createdCount?: number; rowErrors?: ImportRowError[] };

export async function createTrainingPlanAction(
  basePath: string,
  _prevState: TrainingPlanFormState,
  formData: FormData
): Promise<TrainingPlanFormState> {
  const session = await requireTutorOrAdmin();

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

  const activity = await prisma.trainingActivity.findUniqueOrThrow({ where: { id: activityId }, select: { status: true } });
  if (activity.status !== "OPEN") {
    throw new Error("Solo se puede cerrar una jornada que está abierta.");
  }

  await prisma.trainingActivity.update({ where: { id: activityId }, data: { status: "CLOSED", closedAt: new Date() } });

  revalidatePath(`${basePath}/${planId}`);
  revalidatePath(`${basePath}/${planId}/actividades/${activityId}`);
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
