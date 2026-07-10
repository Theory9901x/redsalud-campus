"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTrainingPlanAccess, requireTrainingActivityAccess, requireSurveyAccess } from "@/lib/auth-helpers";
import { surveySchema, surveyQuestionSchema } from "@/lib/validations/survey";

export type SurveyFormState = { error: string | null };
export type SurveyQuestionFormState = { error: string | null; success?: boolean };

/** activityId null = encuesta general del plan; con valor = "participantes de la actividad". */
export async function createSurveyAction(
  basePath: string,
  planId: string,
  activityId: string | null,
  _prevState: SurveyFormState,
  formData: FormData
): Promise<SurveyFormState> {
  const session = await requireTrainingPlanAccess(planId);

  if (activityId) {
    const { planId: activityPlanId } = await requireTrainingActivityAccess(activityId);
    if (activityPlanId !== planId) {
      return { error: "La actividad no pertenece a este plan." };
    }
  }

  const parsed = surveySchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    targetDepartment: formData.get("targetDepartment"),
    targetAudience: formData.get("targetAudience"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const data = parsed.data;

  const survey = await prisma.survey.create({
    data: {
      trainingPlanId: planId,
      trainingActivityId: activityId,
      title: data.title,
      description: data.description || null,
      targetDepartment: data.targetDepartment || null,
      targetAudience: data.targetAudience,
      createdBy: session.user.id,
    },
  });

  revalidatePath(`${basePath}/${planId}`);
  if (activityId) revalidatePath(`${basePath}/${planId}/actividades/${activityId}`);
  redirect(`${basePath}/${planId}/encuestas/${survey.id}`);
}

function parseQuestionForm(formData: FormData) {
  const optionsRaw = formData.get("optionsJson");
  let options: unknown = [];
  try {
    options = JSON.parse(typeof optionsRaw === "string" ? optionsRaw : "[]");
  } catch {
    options = [];
  }

  return surveyQuestionSchema.safeParse({
    type: formData.get("type"),
    statement: formData.get("statement"),
    isRequired: formData.get("isRequired") === "on" || formData.get("isRequired") === "true",
    scaleMin: formData.get("scaleMin") || undefined,
    scaleMax: formData.get("scaleMax") || undefined,
    options,
  });
}

export async function createSurveyQuestionAction(
  basePath: string,
  planId: string,
  surveyId: string,
  _prevState: SurveyQuestionFormState,
  formData: FormData
): Promise<SurveyQuestionFormState> {
  await requireSurveyAccess(surveyId);

  const parsed = parseQuestionForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const data = parsed.data;

  const count = await prisma.surveyQuestion.count({ where: { surveyId } });
  const isScale = data.type === "SCALE";
  const isChoice = data.type === "SINGLE_CHOICE" || data.type === "MULTIPLE_CHOICE";

  await prisma.surveyQuestion.create({
    data: {
      surveyId,
      type: data.type,
      statement: data.statement,
      isRequired: data.isRequired,
      scaleMin: isScale ? data.scaleMin ?? 1 : null,
      scaleMax: isScale ? data.scaleMax ?? 5 : null,
      sortOrder: count,
      options: isChoice
        ? { create: data.options.map((o, index) => ({ text: o.text, sortOrder: index })) }
        : undefined,
    },
  });

  revalidatePath(`${basePath}/${planId}/encuestas/${surveyId}`);
  return { error: null, success: true };
}

export async function deleteSurveyQuestionAction(basePath: string, planId: string, surveyId: string, questionId: string) {
  await requireSurveyAccess(surveyId);
  await prisma.surveyQuestion.delete({ where: { id: questionId } });
  revalidatePath(`${basePath}/${planId}/encuestas/${surveyId}`);
}
