import { cache } from "react";
import { prisma } from "@/lib/prisma";

/** Consulta ligera: solo el id de la primera lección, para la redirección inicial del aula. */
export async function getFirstLessonId(courseId: string): Promise<string | null> {
  const lesson = await prisma.lesson.findFirst({
    where: { isActive: true, module: { courseId, isActive: true } },
    orderBy: [{ module: { sortOrder: "asc" } }, { sortOrder: "asc" }],
    select: { id: true },
  });
  return lesson?.id ?? null;
}

export type AulaLesson = {
  id: string;
  title: string;
  contentType: string;
  isRequired: boolean;
  estimatedMinutes: number | null;
  completed: boolean;
  unlocked: boolean;
};

export type AulaQuiz = {
  id: string;
  title: string;
  passingScore: number;
  maxAttempts: number;
  timeLimitMinutes: number | null;
  unlocked: boolean;
  passed: boolean;
  attemptsUsed: number;
  attemptsRemaining: number;
  bestScore: number | null;
};

export type AulaModule = {
  id: string;
  title: string;
  isRequired: boolean;
  lessons: AulaLesson[];
  quiz: AulaQuiz | null;
};

function buildQuizSummary(
  quiz: { id: string; title: string; passingScore: number; maxAttempts: number; timeLimitMinutes: number | null },
  attempts: { score: number | null; passed: boolean | null }[],
  unlocked: boolean
): AulaQuiz {
  const finished = attempts.filter((a) => a.score !== null);
  const bestScore = finished.length > 0 ? Math.max(...finished.map((a) => a.score!)) : null;
  return {
    id: quiz.id,
    title: quiz.title,
    passingScore: quiz.passingScore,
    maxAttempts: quiz.maxAttempts,
    timeLimitMinutes: quiz.timeLimitMinutes,
    unlocked,
    passed: attempts.some((a) => a.passed === true),
    attemptsUsed: attempts.length,
    attemptsRemaining: Math.max(0, quiz.maxAttempts - attempts.length),
    bestScore,
  };
}

/**
 * `cache()` deduplica esta consulta dentro de la misma petición: el layout
 * del aula y la página de la lección la llaman por separado, pero solo se
 * ejecuta una vez contra la base de datos.
 */
export const getAulaData = cache(async (courseId: string, userId: string) => {
  const [course, enrollment] = await Promise.all([
    prisma.course.findUnique({
      where: { id: courseId },
      include: {
        modules: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
          include: { lessons: { where: { isActive: true }, orderBy: { sortOrder: "asc" } } },
        },
        quizzes: { where: { isActive: true }, orderBy: { title: "asc" } },
      },
    }),
    prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    }),
  ]);

  if (!course || !enrollment || enrollment.status === "CANCELLED") return null;

  const [completedLessonIds, allAttempts] = await Promise.all([
    prisma.lessonProgress
      .findMany({
        where: { userId, status: "COMPLETED", lesson: { module: { courseId } } },
        select: { lessonId: true },
      })
      .then((rows) => new Set(rows.map((p) => p.lessonId))),
    prisma.quizAttempt.findMany({
      where: { userId, quiz: { courseId } },
      select: { quizId: true, score: true, passed: true },
    }),
  ]);

  const attemptsByQuiz = new Map<string, { score: number | null; passed: boolean | null }[]>();
  for (const attempt of allAttempts) {
    const list = attemptsByQuiz.get(attempt.quizId) ?? [];
    list.push({ score: attempt.score, passed: attempt.passed });
    attemptsByQuiz.set(attempt.quizId, list);
  }

  const quizzesByModuleId = new Map<string | null, typeof course.quizzes>();
  for (const quiz of course.quizzes) {
    const list = quizzesByModuleId.get(quiz.moduleId) ?? [];
    list.push(quiz);
    quizzesByModuleId.set(quiz.moduleId, list);
  }

  let priorGateComplete = true;
  const modules: AulaModule[] = course.modules.map((module_) => {
    let moduleLessonsAllRequiredDone = true;
    const lessons = module_.lessons.map((lesson) => {
      const completed = completedLessonIds.has(lesson.id);
      const unlocked = !course.isSequential || priorGateComplete;
      if (lesson.isRequired && !completed) moduleLessonsAllRequiredDone = false;
      return {
        id: lesson.id,
        title: lesson.title,
        contentType: lesson.contentType,
        isRequired: lesson.isRequired,
        estimatedMinutes: lesson.estimatedMinutes,
        completed,
        unlocked,
      };
    });

    const moduleQuizRaw = quizzesByModuleId.get(module_.id)?.[0] ?? null;
    let quiz: AulaQuiz | null = null;
    if (moduleQuizRaw) {
      const unlocked = !course.isSequential || (priorGateComplete && moduleLessonsAllRequiredDone);
      quiz = buildQuizSummary(moduleQuizRaw, attemptsByQuiz.get(moduleQuizRaw.id) ?? [], unlocked);
    }

    const moduleGateComplete = moduleLessonsAllRequiredDone && (!quiz || quiz.passed);
    priorGateComplete = priorGateComplete && moduleGateComplete;

    return { id: module_.id, title: module_.title, isRequired: module_.isRequired, lessons, quiz };
  });

  const finalQuizzes: AulaQuiz[] = (quizzesByModuleId.get(null) ?? []).map((quizRaw) => {
    const unlocked = !course.isSequential || priorGateComplete;
    return buildQuizSummary(quizRaw, attemptsByQuiz.get(quizRaw.id) ?? [], unlocked);
  });

  const flattenedLessons = modules.flatMap((m) => m.lessons);

  return { course, enrollment, modules, finalQuizzes, flattenedLessons };
});

/** Datos de un quiz puntual dentro del aula, con acceso ya verificado. */
export async function getAulaQuiz(courseId: string, quizId: string, userId: string) {
  const data = await getAulaData(courseId, userId);
  if (!data) return null;

  const moduleQuiz = data.modules.flatMap((m) => (m.quiz ? [m.quiz] : [])).find((q) => q.id === quizId);
  const finalQuiz = data.finalQuizzes.find((q) => q.id === quizId);
  const quizSummary = moduleQuiz ?? finalQuiz;
  if (!quizSummary) return null;

  return { course: data.course, enrollment: data.enrollment, quizSummary };
}
