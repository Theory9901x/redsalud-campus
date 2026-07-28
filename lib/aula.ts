import { cache } from "react";
import { prisma } from "@/lib/prisma";

export type AulaLesson = {
  id: string;
  title: string;
  contentType: string;
  isRequired: boolean;
  estimatedMinutes: number | null;
  completed: boolean;
  unlocked: boolean;
  /**
   * Qué falta para abrirla, en texto ya redactado. Null si está abierta.
   * Se calcula en el servidor porque es la misma regla que decide el
   * desbloqueo: si el texto se armara en el cliente podría explicar una
   * cosa distinta de la que el servidor aplica.
   */
  motivoBloqueo: string | null;
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
  /** Contadores propios del módulo, para la cabecera del acordeón. */
  completadas: number;
  total: number;
};

/**
 * Avance del curso calculado en la carga, no leído de
 * Enrollment.progressPercentage.
 *
 * Ese campo se recalcula solo cuando la persona completa una lección o envía
 * un cuestionario (ver lib/lesson-progress.ts). Si mientras tanto un
 * administrador desactiva o añade una lección, el valor guardado queda
 * obsoleto hasta la siguiente acción del estudiante. La cabecera muestra el
 * número de ahora mismo.
 *
 * `lecciones` cuenta solo las obligatorias, igual que el recálculo del
 * servidor, para que los dos números no se contradigan.
 */
export type AulaProgreso = {
  totalRequeridas: number;
  completadasRequeridas: number;
  porcentaje: number;
  /** Cuestionarios activos del curso que aún no se han aprobado. */
  cuestionariosPendientes: number;
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
  // Nombre de lo que está frenando el avance, para explicar el bloqueo.
  let bloqueadorActual: string | null = null;

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
        motivoBloqueo: unlocked
          ? null
          : bloqueadorActual
            ? `Primero tienes que terminar ${bloqueadorActual}.`
            : "Tienes que avanzar en orden por el contenido anterior.",
      };
    });

    const moduleQuizRaw = quizzesByModuleId.get(module_.id)?.[0] ?? null;
    let quiz: AulaQuiz | null = null;
    if (moduleQuizRaw) {
      const unlocked = !course.isSequential || (priorGateComplete && moduleLessonsAllRequiredDone);
      quiz = buildQuizSummary(moduleQuizRaw, attemptsByQuiz.get(moduleQuizRaw.id) ?? [], unlocked);
    }

    const moduleGateComplete = moduleLessonsAllRequiredDone && (!quiz || quiz.passed);
    // El primer módulo que no cierra su puerta es el que hay que nombrar en
    // los bloqueos de todo lo que viene después.
    if (priorGateComplete && !moduleGateComplete && bloqueadorActual === null) {
      bloqueadorActual = `el módulo «${module_.title}»`;
    }
    priorGateComplete = priorGateComplete && moduleGateComplete;

    return {
      id: module_.id,
      title: module_.title,
      isRequired: module_.isRequired,
      lessons,
      quiz,
      completadas: lessons.filter((l) => l.completed).length,
      total: lessons.length,
    };
  });

  const finalQuizzes: AulaQuiz[] = (quizzesByModuleId.get(null) ?? []).map((quizRaw) => {
    const unlocked = !course.isSequential || priorGateComplete;
    return buildQuizSummary(quizRaw, attemptsByQuiz.get(quizRaw.id) ?? [], unlocked);
  });

  const flattenedLessons = modules.flatMap((m) => m.lessons);

  const requeridas = flattenedLessons.filter((l) => l.isRequired);
  const progreso: AulaProgreso = {
    totalRequeridas: requeridas.length,
    completadasRequeridas: requeridas.filter((l) => l.completed).length,
    porcentaje:
      requeridas.length === 0
        ? 100
        : Math.round((requeridas.filter((l) => l.completed).length / requeridas.length) * 100),
    cuestionariosPendientes: [...modules.flatMap((m) => (m.quiz ? [m.quiz] : [])), ...finalQuizzes].filter(
      (q) => !q.passed
    ).length,
  };

  /**
   * Dónde retomar: la primera lección abierta sin completar. Si ya están
   * todas, la última que vio, para que al volver no aterrice en la primera.
   *
   * Se deduce del progreso en vez de guardar un campo "última visitada":
   * un campo más habría que mantenerlo sincronizado y puede mentir; esto
   * siempre concuerda con lo que la persona tiene hecho.
   */
  const siguiente = flattenedLessons.find((l) => l.unlocked && !l.completed);
  const leccionParaReanudar = siguiente?.id ?? flattenedLessons[flattenedLessons.length - 1]?.id ?? null;

  return { course, enrollment, modules, finalQuizzes, flattenedLessons, progreso, leccionParaReanudar };
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

export type NotaRepasoItem = {
  questionId: string;
  statement: string;
  /** Texto de la o las opciones correctas (vacío en preguntas abiertas). */
  correctas: string[];
  /** Respuesta modelo, solo en preguntas de respuesta abierta. */
  respuestaEsperada: string | null;
  explanation: string | null;
  /** Si la persona ya la había acertado en ese intento. */
  acertada: boolean;
};

/**
 * "Nota de repaso": qué era lo correcto según el ÚLTIMO intento fallido.
 *
 * Se construye a partir del intento ya calificado, nunca antes: en el primer
 * intento no existe y no hay nada que consultar. A partir del segundo, la
 * persona ya se ganó la información porque falló una vez, y tenerla a mano
 * mientras repite es justo el punto —son ~30 módulos y el objetivo es que
 * aprendan, no que adivinen—.
 */
export async function getNotaRepaso(quizId: string, userId: string): Promise<NotaRepasoItem[]> {
  const ultimo = await prisma.quizAttempt.findFirst({
    where: { quizId, userId, finishedAt: { not: null } },
    orderBy: { attemptNumber: "desc" },
    include: {
      answers: {
        include: {
          question: {
            select: {
              id: true,
              statement: true,
              type: true,
              explanation: true,
              expectedAnswer: true,
              sortOrder: true,
              options: { where: { isCorrect: true }, select: { text: true } },
            },
          },
        },
      },
    },
  });
  if (!ultimo || ultimo.passed) return [];

  return ultimo.answers
    .sort((a, b) => a.question.sortOrder - b.question.sortOrder)
    .map((a) => ({
      questionId: a.questionId,
      statement: a.question.statement,
      correctas: a.question.options.map((o) => o.text),
      respuestaEsperada: a.question.type === "OPEN_TEXT" ? a.question.expectedAnswer : null,
      explanation: a.question.explanation,
      acertada: a.isCorrect,
    }));
}
