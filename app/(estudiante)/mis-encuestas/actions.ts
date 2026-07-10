"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getSurveyForStudent } from "@/lib/surveys";

export type SurveyResponseFormState = { error: string | null };

type AnswerDraft =
  | { optionId: string }
  | { optionIds: string[] }
  | { value: number }
  | { text: string };

/** Población fija y verificable: solo responde quien tiene sesión iniciada y pertenece a la audiencia objetivo. */
export async function submitSurveyResponseAction(
  surveyId: string,
  _prevState: SurveyResponseFormState,
  formData: FormData
): Promise<SurveyResponseFormState> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = session.user.id;

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { department: true, personnelType: true },
  });

  const { survey, alreadyAnswered, activityClosed } = await getSurveyForStudent(surveyId, userId, user.department, user.personnelType);
  if (!survey) return { error: "Esta encuesta no está disponible para ti." };
  if (alreadyAnswered) return { error: "Ya respondiste esta encuesta." };
  if (activityClosed) return { error: "La jornada de esta actividad ya cerró. Ya no se admiten respuestas." };

  const answersRaw = formData.get("answersJson");
  let answers: Record<string, AnswerDraft>;
  try {
    answers = JSON.parse(typeof answersRaw === "string" ? answersRaw : "{}");
  } catch {
    return { error: "Datos inválidos." };
  }

  for (const question of survey.questions) {
    const answer = answers[question.id];
    if (question.isRequired && !answer) {
      return { error: `Falta responder: "${question.statement}"` };
    }
    if (!answer) continue;

    if (question.type === "SINGLE_CHOICE") {
      if (!("optionId" in answer) || !question.options.some((o) => o.id === answer.optionId)) {
        return { error: "Selecciona una opción válida." };
      }
    } else if (question.type === "MULTIPLE_CHOICE") {
      if (!("optionIds" in answer) || !answer.optionIds.every((id) => question.options.some((o) => o.id === id))) {
        return { error: "Selecciona opciones válidas." };
      }
    } else if (question.type === "SCALE") {
      const min = question.scaleMin ?? 1;
      const max = question.scaleMax ?? 5;
      if (!("value" in answer) || answer.value < min || answer.value > max) {
        return { error: "Valor de escala inválido." };
      }
    } else if (question.type === "TEXT") {
      if (!("text" in answer) || typeof answer.text !== "string") {
        return { error: "Respuesta de texto inválida." };
      }
    }
  }

  await prisma.surveyResponse.create({
    data: {
      surveyId,
      userId,
      answers: {
        create: survey.questions
          .filter((q) => answers[q.id])
          .map((q) => {
            const answer = answers[q.id];
            if (q.type === "SINGLE_CHOICE" && "optionId" in answer) {
              return { questionId: q.id, selectedOptions: { create: [{ optionId: answer.optionId }] } };
            }
            if (q.type === "MULTIPLE_CHOICE" && "optionIds" in answer) {
              return { questionId: q.id, selectedOptions: { create: answer.optionIds.map((optionId) => ({ optionId })) } };
            }
            if (q.type === "SCALE" && "value" in answer) {
              return { questionId: q.id, scaleValue: answer.value };
            }
            return { questionId: q.id, textValue: "text" in answer ? answer.text : null };
          }),
      },
    },
  });

  revalidatePath("/mis-encuestas");
  redirect("/mis-encuestas");
}
