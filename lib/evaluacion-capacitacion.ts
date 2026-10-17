import { prisma } from "@/lib/prisma";

/**
 * EVALUACIÓN PRESABER / POSTSABER DE UNA CAPACITACIÓN.
 *
 * Las capacitaciones del plan no van amarradas a cursos: el área arma su
 * evaluación directamente en la capacitación. Por debajo se reutiliza el
 * motor de cuestionarios (intentos, momentos, calificación, resultados) con
 * un CONTENEDOR INTERNO: un Course marcado `esContenedorCapacitacion`, con el
 * título de la capacitación y una sola evaluación final. Ese contenedor no
 * se lista nunca como curso.
 *
 * Las capacitaciones que ya venían vinculadas a un curso real lo conservan:
 * su evaluación final es la evaluación de la capacitación (se edita desde la
 * misma pestaña) y sus lecciones se muestran como material de la
 * capacitación, de solo lectura.
 */

const TITULO_EVALUACION = "Evaluación presaber / postsaber";

/** Slug único e interno del contenedor: nunca se navega a él. */
function slugContenedor(activityId: string) {
  return `capacitacion-${activityId}`;
}

/**
 * Crea la evaluación de una capacitación que aún no tiene ninguna. Si la
 * capacitación ya tiene contenedor o curso vinculado sin evaluación final,
 * le crea solo la evaluación. Idempotente: si ya existe, no hace nada.
 */
export async function crearEvaluacionCapacitacion(activityId: string, creadorId: string) {
  const actividad = await prisma.trainingActivity.findUniqueOrThrow({
    where: { id: activityId },
    select: {
      id: true,
      title: true,
      courseId: true,
      targetAudience: true,
      responsibleUserId: true,
      area: { select: { tutorId: true } },
      plan: { select: { tutorId: true } },
    },
  });

  let courseId = actividad.courseId;
  if (!courseId) {
    const contenedor = await prisma.course.create({
      data: {
        title: actividad.title,
        slug: slugContenedor(actividad.id),
        shortDescription: "Evaluación presaber/postsaber de una capacitación del plan.",
        courseType: "CAPACITACION",
        durationHours: 1,
        // Publicado para que el motor del aula admita a la persona; nunca se
        // lista: los listados excluyen los contenedores y todo lo del plan.
        status: "PUBLISHED",
        publishedAt: new Date(),
        enrollmentMode: "ASSIGNED",
        targetAudience: actividad.targetAudience,
        tutorId: actividad.area?.tutorId ?? actividad.responsibleUserId ?? actividad.plan.tutorId ?? creadorId,
        esContenedorCapacitacion: true,
      },
      select: { id: true },
    });
    courseId = contenedor.id;
    await prisma.trainingActivity.update({ where: { id: activityId }, data: { courseId } });
  }

  const existente = await prisma.quiz.findFirst({ where: { courseId, moduleId: null }, select: { id: true } });
  if (existente) return existente.id;

  const quiz = await prisma.quiz.create({
    data: {
      courseId,
      moduleId: null,
      title: TITULO_EVALUACION,
      passingScore: 80,
      // Por momento: el presaber se presenta una vez (en el ciclo automático
      // el siguiente intento ya es postsaber); el postsaber admite repetir.
      maxAttempts: 3,
      showResultsNow: true,
    },
    select: { id: true },
  });
  return quiz.id;
}

export type EvaluacionCapacitacion = {
  /** "contenedor": evaluación propia de la capacitación; "vinculada": capacitación antigua con curso real. */
  origen: "contenedor" | "vinculada";
  courseId: string;
  quiz: {
    id: string;
    title: string;
    description: string | null;
    passingScore: number;
    maxAttempts: number;
    timeLimitMinutes: number | null;
    randomizeQuestions: boolean;
    randomizeAnswers: boolean;
    showResultsNow: boolean;
    isActive: boolean;
    questions: {
      id: string;
      type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE" | "OPEN_TEXT";
      statement: string;
      imageUrl: string | null;
      expectedAnswer: string | null;
      score: number;
      explanation: string | null;
      options: { id: string; text: string; isCorrect: boolean }[];
    }[];
  } | null;
  /** Lecciones del curso vinculado (solo capacitaciones antiguas): material de solo lectura. */
  material: { modulo: string; titulo: string; tipo: string }[];
};

/** La evaluación (y el material, si lo hay) de una capacitación, o null si aún no tiene. */
export async function getEvaluacionCapacitacion(activityId: string): Promise<EvaluacionCapacitacion | null> {
  const actividad = await prisma.trainingActivity.findUnique({
    where: { id: activityId },
    select: { course: { select: { id: true, esContenedorCapacitacion: true } } },
  });
  if (!actividad?.course) return null;
  const { id: courseId, esContenedorCapacitacion } = actividad.course;

  const [quiz, modulos] = await Promise.all([
    prisma.quiz.findFirst({
      where: { courseId, moduleId: null },
      orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }],
      select: {
        id: true,
        title: true,
        description: true,
        passingScore: true,
        maxAttempts: true,
        timeLimitMinutes: true,
        randomizeQuestions: true,
        randomizeAnswers: true,
        showResultsNow: true,
        isActive: true,
        questions: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            type: true,
            statement: true,
            imageUrl: true,
            expectedAnswer: true,
            score: true,
            explanation: true,
            options: { orderBy: { sortOrder: "asc" }, select: { id: true, text: true, isCorrect: true } },
          },
        },
      },
    }),
    esContenedorCapacitacion
      ? Promise.resolve([])
      : prisma.courseModule.findMany({
          where: { courseId, isActive: true },
          orderBy: { sortOrder: "asc" },
          select: {
            title: true,
            lessons: { where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { title: true, contentType: true } },
          },
        }),
  ]);

  return {
    origen: esContenedorCapacitacion ? "contenedor" : "vinculada",
    courseId,
    quiz,
    material: modulos.flatMap((m) => m.lessons.map((l) => ({ modulo: m.title, titulo: l.title, tipo: l.contentType }))),
  };
}

/**
 * Capacitaciones (por id) con evaluación presaber/postsaber CONFIGURADA:
 * evaluación activa con al menos una pregunta. Es la base de PIC-COB-02.
 */
export async function actividadesConEvaluacion(actividades: { id: string; courseId: string | null }[]): Promise<Set<string>> {
  const courseIds = [...new Set(actividades.map((a) => a.courseId).filter((x): x is string => !!x))];
  if (courseIds.length === 0) return new Set();
  const quizzes = await prisma.quiz.findMany({
    where: { courseId: { in: courseIds }, moduleId: null, isActive: true, questions: { some: { isActive: true } } },
    select: { courseId: true },
  });
  const conEvaluacion = new Set(quizzes.map((q) => q.courseId));
  return new Set(actividades.filter((a) => a.courseId && conEvaluacion.has(a.courseId)).map((a) => a.id));
}
