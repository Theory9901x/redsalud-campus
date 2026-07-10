"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTutorOrAdmin, requireTrainingPlanAccess, requireTrainingActivityAccess } from "@/lib/auth-helpers";
import { saveTrainingPlanDocument, saveTrainingActivityDocument } from "@/lib/storage";
import { trainingPlanSchema, trainingActivitySchema } from "@/lib/validations/training-plan";

export type TrainingPlanFormState = { error: string | null };
export type TrainingActivityFormState = { error: string | null };
export type TrainingDocumentFormState = { error: string | null };

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
      targetDepartment: data.targetDepartment,
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
