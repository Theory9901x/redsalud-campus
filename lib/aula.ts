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
  /** Posición dentro del módulo, en la misma escala que Lesson.sortOrder. */
  sortOrder: number;
};

/**
 * El recorrido REAL del módulo: lecciones y evaluaciones intercaladas en el
 * orden en que se presentan. Un módulo puede traer varias parejas
 * "presentación → evaluación" (un área con varios temas), así que la vista
 * recorre esto, no dos listas por separado.
 */
export type AulaItem =
  | { tipo: "leccion"; sortOrder: number; leccion: AulaLesson }
  | { tipo: "quiz"; sortOrder: number; quiz: AulaQuiz };

export type AulaModule = {
  id: string;
  title: string;
  isRequired: boolean;
  lessons: AulaLesson[];
  /** Todas las evaluaciones del módulo, en orden. */
  quizzes: AulaQuiz[];
  /** Lecciones y evaluaciones intercaladas, listo para pintar. */
  items: AulaItem[];
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
  quiz: { id: string; title: string; passingScore: number; maxAttempts: number; timeLimitMinutes: number | null; sortOrder?: number },
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
    sortOrder: quiz.sortOrder ?? 0,
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
        quizzes: { where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { title: "asc" }] },
        // Para el panel lateral de la evaluación: área y responsable salen de
        // la ficha del curso, no se escriben a mano en la vista.
        category: { select: { name: true } },
        tutor: { select: { fullName: true } },
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
    // El módulo se recorre como UNA secuencia intercalada de lecciones y
    // evaluaciones ordenadas por sortOrder: un área puede entregar varios
    // temas y cada tema lleva su evaluación justo después de su
    // presentación. El desbloqueo secuencial avanza por esa secuencia, no
    // "todas las lecciones y luego el quiz".
    const crudos = [
      ...module_.lessons.map((l) => ({ tipo: "leccion" as const, sortOrder: l.sortOrder, lesson: l })),
      ...(quizzesByModuleId.get(module_.id) ?? []).map((q) => ({ tipo: "quiz" as const, sortOrder: q.sortOrder, quizRaw: q })),
    ].sort((a, b) => a.sortOrder - b.sortOrder || (a.tipo === "leccion" ? -1 : 1));

    const lessons: AulaLesson[] = [];
    const quizzes: AulaQuiz[] = [];
    const items: AulaItem[] = [];
    // Puerta interna del módulo: lo que va abriendo paso ítem a ítem.
    let gateInterno = priorGateComplete;
    let moduleLessonsAllRequiredDone = true;
    let todasEvaluacionesAprobadas = true;

    for (const crudo of crudos) {
      const unlocked = !course.isSequential || gateInterno;
      if (crudo.tipo === "leccion") {
        const lesson = crudo.lesson;
        const completed = completedLessonIds.has(lesson.id);
        if (lesson.isRequired && !completed) moduleLessonsAllRequiredDone = false;
        const item: AulaLesson = {
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
        lessons.push(item);
        items.push({ tipo: "leccion", sortOrder: crudo.sortOrder, leccion: item });
        // Una lección obligatoria sin completar cierra el paso a lo que sigue.
        if (lesson.isRequired && !completed) {
          gateInterno = false;
          if (bloqueadorActual === null) bloqueadorActual = `«${lesson.title}»`;
        }
      } else {
        const quiz = buildQuizSummary(crudo.quizRaw, attemptsByQuiz.get(crudo.quizRaw.id) ?? [], unlocked);
        if (!quiz.passed) todasEvaluacionesAprobadas = false;
        quizzes.push(quiz);
        items.push({ tipo: "quiz", sortOrder: crudo.sortOrder, quiz });
        // Una evaluación sin aprobar también cierra el paso.
        if (!quiz.passed) {
          gateInterno = false;
          if (bloqueadorActual === null) bloqueadorActual = `la evaluación «${quiz.title}»`;
        }
      }
    }

    const moduleGateComplete = moduleLessonsAllRequiredDone && todasEvaluacionesAprobadas;
    priorGateComplete = priorGateComplete && moduleGateComplete;

    return {
      id: module_.id,
      title: module_.title,
      isRequired: module_.isRequired,
      lessons,
      quizzes,
      items,
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
    cuestionariosPendientes: [...modules.flatMap((m) => m.quizzes), ...finalQuizzes].filter((q) => !q.passed).length,
  };

  /**
   * Dónde retomar: la primera lección abierta sin completar. Si ya están
   * todas, la última que vio, para que al volver no aterrice en la primera.
   *
   * Se deduce del progreso en vez de guardar un campo "última visitada":
   * un campo más habría que mantenerlo sincronizado y puede mentir; esto
   * siempre concuerda con lo que la persona tiene hecho.
   */
  // El destino NUNCA puede ser algo bloqueado: la página de lección devuelve
  // a la raíz cuando el contenido está bloqueado, y la raíz redirige aquí,
  // así que un destino bloqueado era un bucle infinito de redirecciones
  // (pantalla blanca parpadeando). Ocurría justo cuando lo pendiente no era
  // una lección sino un QUIZ: sin "siguiente lección desbloqueada", el
  // fallback antiguo mandaba a la última lección del curso, aún bloqueada.
  const siguienteLeccion = flattenedLessons.find((l) => l.unlocked && !l.completed);
  const quizPendiente =
    modules.flatMap((m) => m.quizzes).find((q) => q.unlocked && !q.passed && q.attemptsRemaining > 0) ??
    finalQuizzes.find((q) => q.unlocked && !q.passed && q.attemptsRemaining > 0) ??
    null;
  const ultimaCompletada = [...flattenedLessons].reverse().find((l) => l.completed);
  const primeraDesbloqueada = flattenedLessons.find((l) => l.unlocked);

  /** A dónde cae quien entra al curso: lo pendiente según su avance real, o repaso si ya terminó. */
  const destinoParaReanudar: { tipo: "leccion" | "quiz"; id: string } | null = siguienteLeccion
    ? { tipo: "leccion", id: siguienteLeccion.id }
    : quizPendiente
      ? { tipo: "quiz", id: quizPendiente.id }
      : ultimaCompletada
        ? { tipo: "leccion", id: ultimaCompletada.id }
        : primeraDesbloqueada
          ? { tipo: "leccion", id: primeraDesbloqueada.id }
          : null;

  return { course, enrollment, modules, finalQuizzes, flattenedLessons, progreso, destinoParaReanudar };
});

/** Datos de un quiz puntual dentro del aula, con acceso ya verificado. */
export async function getAulaQuiz(courseId: string, quizId: string, userId: string) {
  const data = await getAulaData(courseId, userId);
  if (!data) return null;

  const moduleQuiz = data.modules.flatMap((m) => m.quizzes).find((q) => q.id === quizId);
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

export type RespuestaBorrador = {
  questionId: string;
  selectedOptionIds: string[];
  textAnswer: string | null;
  flagged: boolean;
};

/**
 * Borrador en curso de una evaluación: lo que el estudiante lleva respondido
 * sin haber enviado todavía.
 *
 * Se lee del servidor en cada carga, de modo que recargar la página o
 * continuar desde otro equipo recupera exactamente lo mismo. Devuelve lista
 * vacía cuando no hay ningún intento abierto.
 *
 * No expone nada sobre si las respuestas son correctas: mientras el intento
 * siga abierto, esa información no sale del servidor.
 */
export async function getBorradorIntento(quizId: string, userId: string): Promise<RespuestaBorrador[]> {
  const abierto = await prisma.quizAttempt.findFirst({
    where: { userId, quizId, finishedAt: null },
    select: {
      answers: {
        select: { questionId: true, selectedOptionIds: true, textAnswer: true, flagged: true },
      },
    },
  });
  return abierto?.answers ?? [];
}
