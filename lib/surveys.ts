import { prisma } from "@/lib/prisma";
import { getTargetAudienceUsers } from "@/lib/training-plans";
import type { CourseAudience, PersonnelType } from "@prisma/client";

const questionInclude = {
  orderBy: { sortOrder: "asc" as const },
  include: { options: { orderBy: { sortOrder: "asc" as const } } },
};

/** Encuestas del plan: tanto las generales del plan como las de cada actividad puntual. */
export async function getSurveysForPlan(planId: string) {
  const surveys = await prisma.survey.findMany({
    where: { trainingPlanId: planId },
    orderBy: { createdAt: "desc" },
    include: {
      trainingActivity: { select: { id: true, title: true } },
      _count: { select: { responses: true, questions: true } },
    },
  });
  return withTargetCounts(surveys);
}

/** Encuestas propias de una actividad puntual ("participantes de la actividad"). */
export async function getSurveysForActivity(activityId: string) {
  const surveys = await prisma.survey.findMany({
    where: { trainingActivityId: activityId },
    orderBy: { createdAt: "desc" },
    include: {
      trainingActivity: { select: { id: true, title: true } },
      _count: { select: { responses: true, questions: true } },
    },
  });
  return withTargetCounts(surveys);
}

async function withTargetCounts<
  T extends { targetDepartment: string; targetAudience: CourseAudience; _count: { responses: number } }
>(surveys: T[]) {
  return Promise.all(
    surveys.map(async (survey) => {
      const targetUsers = await getTargetAudienceUsers(survey.targetDepartment, survey.targetAudience);
      return { ...survey, targetCount: targetUsers.length };
    })
  );
}

export async function getSurveyDetail(surveyId: string) {
  return prisma.survey.findUnique({
    where: { id: surveyId },
    include: {
      trainingPlan: { select: { id: true, title: true, tutorId: true, targetDepartment: true } },
      trainingActivity: { select: { id: true, title: true } },
      questions: questionInclude,
    },
  });
}

export type SurveyQuestionResult =
  | { type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE"; statement: string; options: { text: string; count: number }[]; totalAnswers: number }
  | { type: "SCALE"; statement: string; average: number | null; distribution: { value: number; count: number }[]; totalAnswers: number }
  | { type: "TEXT"; statement: string; texts: string[]; totalAnswers: number };

/** Resultados agregados por pregunta + quiénes de la audiencia objetivo aún no responden. */
export async function getSurveyResults(surveyId: string) {
  const survey = await prisma.survey.findUniqueOrThrow({
    where: { id: surveyId },
    include: {
      questions: questionInclude,
      responses: {
        include: { user: { select: { id: true, fullName: true, documentNumber: true } }, answers: { include: { selectedOptions: true } } },
      },
    },
  });

  const targetUsers = await getTargetAudienceUsers(survey.targetDepartment, survey.targetAudience);
  const respondedIds = new Set(survey.responses.map((r) => r.userId));
  const missing = targetUsers.filter((u) => !respondedIds.has(u.id));

  const questionResults: SurveyQuestionResult[] = survey.questions.map((question) => {
    const answers = survey.responses.flatMap((r) => r.answers.filter((a) => a.questionId === question.id));

    if (question.type === "SINGLE_CHOICE" || question.type === "MULTIPLE_CHOICE") {
      const counts = new Map(question.options.map((o) => [o.id, 0]));
      for (const answer of answers) {
        for (const selected of answer.selectedOptions) {
          counts.set(selected.optionId, (counts.get(selected.optionId) ?? 0) + 1);
        }
      }
      return {
        type: question.type,
        statement: question.statement,
        options: question.options.map((o) => ({ text: o.text, count: counts.get(o.id) ?? 0 })),
        totalAnswers: answers.length,
      };
    }

    if (question.type === "SCALE") {
      const values = answers.map((a) => a.scaleValue).filter((v): v is number => v !== null);
      const min = question.scaleMin ?? 1;
      const max = question.scaleMax ?? 5;
      const distribution = Array.from({ length: max - min + 1 }, (_, i) => {
        const value = min + i;
        return { value, count: values.filter((v) => v === value).length };
      });
      return {
        type: "SCALE",
        statement: question.statement,
        average: values.length > 0 ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : null,
        distribution,
        totalAnswers: values.length,
      };
    }

    return {
      type: "TEXT",
      statement: question.statement,
      texts: answers.map((a) => a.textValue).filter((t): t is string => !!t && t.trim().length > 0),
      totalAnswers: answers.length,
    };
  });

  return {
    survey,
    targetCount: targetUsers.length,
    respondedCount: survey.responses.length,
    missing,
    questionResults,
  };
}

/** Encuestas asignadas al usuario (audiencia objetivo), separadas en pendientes/respondidas. */
export async function getSurveysForUser(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { department: true, personnelType: true },
  });
  if (!user.department) return { pending: [], answered: [] };

  const surveys = await prisma.survey.findMany({
    where: {
      targetDepartment: { equals: user.department, mode: "insensitive" },
      OR: [{ targetAudience: "AMBOS" }, { targetAudience: user.personnelType }],
    },
    orderBy: { createdAt: "desc" },
    include: {
      trainingPlan: { select: { title: true } },
      trainingActivity: { select: { title: true } },
      _count: { select: { questions: true } },
      responses: { where: { userId }, select: { id: true } },
    },
  });

  return {
    pending: surveys.filter((s) => s.responses.length === 0 && s._count.questions > 0),
    answered: surveys.filter((s) => s.responses.length > 0),
  };
}

/** Encuesta para responder: null si no existe, no aplica a este usuario, o ya fue respondida. */
export async function getSurveyForStudent(surveyId: string, userId: string, userDepartment: string | null, personnelType: PersonnelType) {
  const survey = await prisma.survey.findUnique({
    where: { id: surveyId },
    include: { questions: questionInclude, trainingActivity: { select: { status: true } } },
  });
  if (!survey) return { survey: null, alreadyAnswered: false, activityClosed: false };

  const matchesAudience =
    !!userDepartment &&
    userDepartment.trim().toLowerCase() === survey.targetDepartment.trim().toLowerCase() &&
    (survey.targetAudience === "AMBOS" || survey.targetAudience === personnelType);
  if (!matchesAudience) return { survey: null, alreadyAnswered: false, activityClosed: false };

  const existingResponse = await prisma.surveyResponse.findUnique({
    where: { surveyId_userId: { surveyId, userId } },
    select: { id: true },
  });

  return {
    survey,
    alreadyAnswered: !!existingResponse,
    // Etapa 6: si la encuesta es de una actividad puntual y esa jornada ya cerró, no se admiten más respuestas.
    activityClosed: survey.trainingActivity?.status === "CLOSED",
  };
}
