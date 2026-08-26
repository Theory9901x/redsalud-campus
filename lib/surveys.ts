import { prisma } from "@/lib/prisma";
import { getTargetAudienceUsers, getTargetAudienceCount } from "@/lib/training-plans";
import { configSinClave, leerConfig, type ValorRespuesta } from "@/lib/encuestas/tipos";
import type { CourseAudience, PersonnelType, Prisma } from "@prisma/client";

/**
 * Lo que el resto de la plataforma necesita de las encuestas: el tablero del
 * plan, la pestaña del estudiante y los informes.
 *
 * La construcción, el enlace público y el panel de resultados viven en
 * `lib/encuestas/` -el módulo propio-. Aquí queda solo el puente con el
 * módulo de planes, que es lo que ya consumían estas pantallas.
 */

/** Solo cuentan como "asignables" las encuestas publicadas y no plantilla. */
const VIVAS: Prisma.SurveyWhereInput = { status: "PUBLISHED", isTemplate: false };

const paginasConPreguntas = {
  orderBy: { sortOrder: "asc" as const },
  include: { questions: { orderBy: { sortOrder: "asc" as const } } },
};

/** Cuántas preguntas tiene una encuesta, sumando las de todas sus páginas. */
function contarPreguntas(pages: { _count: { questions: number } }[]) {
  return pages.reduce((s, p) => s + p._count.questions, 0);
}

/** Encuestas del plan: las generales y las de cada jornada. */
export async function getSurveysForPlan(planId: string) {
  const surveys = await prisma.survey.findMany({
    where: { trainingPlanId: planId, isTemplate: false },
    orderBy: { createdAt: "desc" },
    include: {
      trainingActivity: { select: { id: true, title: true } },
      pages: { select: { _count: { select: { questions: true } } } },
      _count: { select: { responses: true } },
    },
  });
  return withTargetCounts(surveys.map((s) => ({ ...s, preguntas: contarPreguntas(s.pages) })));
}

/** Tasa de respuesta agregada (respondidas / objetivo). Pura, sin acceso a datos. */
export function buildSurveyResponseRate(surveys: { targetCount: number; _count: { responses: number } }[]) {
  const totalTarget = surveys.reduce((sum, s) => sum + s.targetCount, 0);
  const totalResponded = surveys.reduce((sum, s) => sum + s._count.responses, 0);
  return totalTarget > 0 ? Math.round((totalResponded / totalTarget) * 100) : null;
}

/** Encuestas propias de una jornada puntual. */
export async function getSurveysForActivity(activityId: string) {
  const surveys = await prisma.survey.findMany({
    where: { trainingActivityId: activityId, isTemplate: false },
    orderBy: { createdAt: "desc" },
    include: {
      trainingActivity: { select: { id: true, title: true } },
      pages: { select: { _count: { select: { questions: true } } } },
      _count: { select: { responses: true } },
    },
  });
  return withTargetCounts(surveys.map((s) => ({ ...s, preguntas: contarPreguntas(s.pages) })));
}

async function withTargetCounts<
  T extends { targetDepartment: string | null; targetAudience: CourseAudience; _count: { responses: number } }
>(surveys: T[]) {
  return Promise.all(
    surveys.map(async (survey) => {
      const targetCount = await getTargetAudienceCount(survey.targetDepartment, survey.targetAudience);
      return { ...survey, targetCount };
    })
  );
}

export async function getSurveyDetail(surveyId: string) {
  return prisma.survey.findUnique({
    where: { id: surveyId },
    include: {
      trainingPlan: { select: { id: true, title: true, tutorId: true, targetDepartment: true } },
      trainingActivity: { select: { id: true, title: true } },
      pages: paginasConPreguntas,
    },
  });
}

/**
 * Quiénes de la audiencia objetivo todavía no responden.
 *
 * Es el único punto del módulo que sí trae una lista nominal, y a propósito:
 * el seguimiento de Talento Humano necesita saber A QUIÉN le falta, no
 * cuántos faltan.
 */
export async function getSurveyMissingRespondents(surveyId: string) {
  const survey = await prisma.survey.findUniqueOrThrow({
    where: { id: surveyId },
    select: { targetDepartment: true, targetAudience: true },
  });
  const [objetivo, respondieron] = await Promise.all([
    getTargetAudienceUsers(survey.targetDepartment, survey.targetAudience),
    prisma.surveyResponse.findMany({
      where: { surveyId, userId: { not: null } },
      select: { userId: true },
    }),
  ]);
  const ya = new Set(respondieron.map((r) => r.userId));
  const faltan = objetivo.filter((u) => !ya.has(u.id));
  return { objetivo: objetivo.length, respondieron: ya.size, faltan };
}

/**
 * Encuestas que le aplican a una persona, separadas en pendientes y
 * respondidas. `planId` acota a un solo plan (detalle del estudiante).
 */
export async function getSurveysForUser(userId: string, planId?: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { department: true, personnelType: true },
  });

  const surveys = await prisma.survey.findMany({
    where: {
      AND: [
        VIVAS,
        ...(planId ? [{ trainingPlanId: planId }] : []),
        {
          OR: [
            { targetDepartment: null },
            ...(user.department ? [{ targetDepartment: { equals: user.department, mode: "insensitive" as const } }] : []),
          ],
        },
        { OR: [{ targetAudience: "AMBOS" as const }, { targetAudience: user.personnelType }] },
      ],
    },
    orderBy: { createdAt: "desc" },
    include: {
      trainingPlan: { select: { title: true } },
      trainingActivity: {
        select: { title: true, area: { select: { name: true, tutor: { select: { fullName: true } } } } },
      },
      pages: { select: { _count: { select: { questions: true } } } },
      responses: { where: { userId, completed: true }, select: { id: true } },
    },
  });

  const conConteo = surveys.map((s) => ({ ...s, _count: { questions: contarPreguntas(s.pages) } }));
  return {
    pending: conConteo.filter((s) => s.responses.length === 0 && s._count.questions > 0),
    answered: conConteo.filter((s) => s.responses.length > 0),
  };
}

/** Encuesta lista para responder desde la plataforma, ya sin clave de respuesta. */
export async function getSurveyForStudent(
  surveyId: string,
  userId: string,
  userDepartment: string | null,
  personnelType: PersonnelType
) {
  const survey = await prisma.survey.findUnique({
    where: { id: surveyId },
    include: { pages: paginasConPreguntas, trainingActivity: { select: { status: true } } },
  });
  if (!survey) return { survey: null, alreadyAnswered: false, activityClosed: false };

  const matchesDepartment =
    !survey.targetDepartment ||
    (!!userDepartment && userDepartment.trim().toLowerCase() === survey.targetDepartment.trim().toLowerCase());
  const matchesAudience =
    matchesDepartment && (survey.targetAudience === "AMBOS" || survey.targetAudience === personnelType);
  if (!matchesAudience) return { survey: null, alreadyAnswered: false, activityClosed: false };

  const yaRespondio = await prisma.surveyResponse.findFirst({
    where: { surveyId, userId, completed: true },
    select: { id: true },
  });

  return {
    // Sin clave: aunque esta ruta exige sesión, la respuesta correcta no
    // viaja al navegador de quien va a contestar.
    survey: {
      ...survey,
      pages: survey.pages.map((p) => ({
        ...p,
        questions: p.questions.map((q) => ({ ...q, config: configSinClave(q.config) })),
      })),
    },
    alreadyAnswered: !!yaRespondio,
    activityClosed: survey.trainingActivity?.status === "CLOSED",
  };
}

/** Resumen por pregunta para la ficha de la jornada (versión compacta del panel de resultados). */
export type SurveyQuestionResult = {
  type: string;
  statement: string;
  totalAnswers: number;
  options?: { text: string; count: number }[];
  average?: number | null;
  distribution?: { value: number; count: number }[];
  texts?: string[];
};

export async function getSurveyResults(surveyId: string) {
  const survey = await prisma.survey.findUniqueOrThrow({
    where: { id: surveyId },
    include: { pages: paginasConPreguntas },
  });

  const [respuestas, faltantes] = await Promise.all([
    prisma.surveyResponse.findMany({
      where: { surveyId, completed: true },
      select: { answers: { select: { questionId: true, value: true, textValue: true } } },
    }),
    getSurveyMissingRespondents(surveyId),
  ]);

  const porPregunta = new Map<string, { value: unknown; textValue: string | null }[]>();
  for (const r of respuestas) {
    for (const a of r.answers) {
      const lista = porPregunta.get(a.questionId) ?? [];
      lista.push({ value: a.value, textValue: a.textValue });
      porPregunta.set(a.questionId, lista);
    }
  }

  const questionResults: SurveyQuestionResult[] = survey.pages.flatMap((pagina) =>
    pagina.questions.map((q) => {
      const dadas = porPregunta.get(q.id) ?? [];
      const config = leerConfig(q.config);

      if (config.opciones?.length) {
        const conteo = new Map<string, number>();
        for (const d of dadas) {
          const v = d.value as ValorRespuesta | null;
          if (v?.tipo === "opcion") conteo.set(v.opcionId, (conteo.get(v.opcionId) ?? 0) + 1);
          if (v?.tipo === "opciones") for (const o of v.opcionIds) conteo.set(o, (conteo.get(o) ?? 0) + 1);
        }
        return {
          type: q.type,
          statement: q.prompt,
          totalAnswers: dadas.length,
          options: config.opciones.map((o) => ({ text: o.texto, count: conteo.get(o.id) ?? 0 })),
        };
      }

      if (q.type === "SCALE" || q.type === "NUMBER") {
        const valores = dadas
          .map((d) => {
            const v = d.value as ValorRespuesta | null;
            return v?.tipo === "escala" || v?.tipo === "numero" ? v.valor : null;
          })
          .filter((n): n is number => n !== null);
        const dist = new Map<number, number>();
        for (const v of valores) dist.set(v, (dist.get(v) ?? 0) + 1);
        return {
          type: q.type,
          statement: q.prompt,
          totalAnswers: valores.length,
          average:
            valores.length > 0 ? Math.round((valores.reduce((a, b) => a + b, 0) / valores.length) * 10) / 10 : null,
          distribution: [...dist.entries()].sort((a, b) => a[0] - b[0]).map(([value, count]) => ({ value, count })),
        };
      }

      return {
        type: q.type,
        statement: q.prompt,
        totalAnswers: dadas.length,
        texts: dadas.map((d) => d.textValue ?? "").filter((t) => t.trim().length > 0),
      };
    })
  );

  return {
    survey,
    targetCount: faltantes.objetivo,
    respondedCount: faltantes.respondieron,
    missing: faltantes.faltan,
    questionResults,
  };
}
