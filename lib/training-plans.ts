import { prisma } from "@/lib/prisma";
import { compararAdherencia, momentoActivo, momentoParaPersona, cicloEsAutomatico } from "@/lib/presaber-postsaber";
import type { Role, CourseAudience, TrainingActivityStatus } from "@prisma/client";

/**
 * ADMIN ve todos los planes. Un TUTOR ve los que responde y, además, aquellos
 * donde su área tiene capacitaciones: el plan institucional es de Talento
 * Humano, pero cada área responde por su parte y necesita llegar a ella.
 */
export function trainingPlanScopeWhere(role: Role, userId: string) {
  if (role === "ADMIN") return {};
  return {
    OR: [{ tutorId: userId }, { activities: { some: { area: { tutorId: userId } } } }],
  };
}

export async function getTrainingPlans(role: Role, userId: string) {
  return prisma.trainingPlan.findMany({
    where: trainingPlanScopeWhere(role, userId),
    orderBy: [{ year: "desc" }, { createdAt: "desc" }],
    include: {
      tutor: { select: { fullName: true } },
      _count: { select: { activities: true } },
    },
  });
}

const documentInclude = {
  orderBy: { createdAt: "desc" as const },
  include: { uploader: { select: { fullName: true } } },
};

export async function getTrainingPlanDetail(id: string) {
  return prisma.trainingPlan.findUnique({
    where: { id },
    include: {
      tutor: { select: { fullName: true } },
      closedByUser: { select: { fullName: true } },
      activities: {
        // Primero lo que tiene fecha; lo programado solo por trimestre va
        // después en orden de trimestre, y el título desempata para que el
        // cronograma no cambie de orden entre recargas.
        orderBy: [{ startDate: "asc" }, { quarters: "asc" }, { title: "asc" }],
        include: {
          course: { select: { id: true, title: true, slug: true } },
          area: { select: { id: true, name: true, sortOrder: true, tutorId: true } },
          // Solo la próxima: es lo que el cronograma necesita para preferir
          // "12 de mayo" sobre "Trimestre II" cuando ya se agendó un día real.
          sessions: { orderBy: { startsAt: "asc" }, take: 1, select: { startsAt: true, endsAt: true } },
          _count: { select: { sessions: true } },
        },
      },
      documents: documentInclude,
    },
  });
}

/**
 * Planes que le aplican a un estudiante: sin dependencia (todo el personal) o
 * con la misma dependencia que el usuario. Solo lectura, sin acciones de
 * edición — es el mismo criterio de audiencia que ya usan encuestas y
 * adherencia (targetAudienceUserWhere), visto desde el lado del estudiante.
 */
export async function getTrainingPlansForStudent(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { department: true } });

  return prisma.trainingPlan.findMany({
    where: {
      OR: [
        { targetDepartment: null },
        ...(user.department ? [{ targetDepartment: { equals: user.department, mode: "insensitive" as const } }] : []),
      ],
    },
    orderBy: [{ year: "desc" }, { createdAt: "desc" }],
    include: {
      tutor: { select: { fullName: true } },
      _count: { select: { activities: true } },
    },
  });
}

/** Detalle de un plan para el estudiante: null si el plan no existe o no le aplica (dependencia distinta). */
export async function getTrainingPlanDetailForStudent(id: string, userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { department: true } });

  const plan = await getTrainingPlanDetail(id);
  if (!plan) return null;

  const matchesDepartment =
    !plan.targetDepartment ||
    (!!user.department && user.department.trim().toLowerCase() === plan.targetDepartment.trim().toLowerCase());
  if (!matchesDepartment) return null;

  return plan;
}

/**
 * Curso y avance real del estudiante, para cada capacitación del plan que ya
 * tiene contenido montado.
 *
 * Aparte de `getTrainingPlanDetail` -que la usan admin y tutor y no necesitan
 * nada de esto- porque aquí hace falta lo que se ve en la tarjeta de curso
 * (imagen, resumen, horas) y la inscripción de ESTA persona, dos cosas que
 * inflarían sin motivo la consulta que usa el panel de gestión.
 */
export async function getStudentCourseProgress(courseIds: string[], userId: string) {
  if (courseIds.length === 0) return new Map<string, never>();

  const [courses, enrollments] = await Promise.all([
    prisma.course.findMany({
      where: { id: { in: courseIds }, status: "PUBLISHED" },
      select: { id: true, title: true, slug: true, shortDescription: true, imageUrl: true, durationHours: true },
    }),
    prisma.enrollment.findMany({
      where: { userId, courseId: { in: courseIds }, status: { not: "CANCELLED" } },
      select: { courseId: true, status: true, progressPercentage: true, completedAt: true },
    }),
  ]);

  const inscripcionPorCurso = new Map(enrollments.map((e) => [e.courseId, e]));
  return new Map(
    courses.map((c) => [c.id, { course: c, enrollment: inscripcionPorCurso.get(c.id) ?? null }])
  );
}

/**
 * Estado del ciclo presaber/postsaber DE ESTA PERSONA en cada curso: qué
 * evaluación final tiene el curso y cuáles momentos ya presentó.
 *
 * Es la mitad que le falta a las ventanas de la actividad para pintar la
 * fila del estudiante: la ventana dice si el momento está abierto; esto dice
 * si esta persona ya lo presentó.
 */
export async function getStudentCycleInfo(courseIds: string[], userId: string) {
  const vacio = new Map<string, { quizId: string; presaberDone: boolean; postsaberDone: boolean }>();
  if (courseIds.length === 0) return vacio;

  const quizzes = await prisma.quiz.findMany({
    where: { courseId: { in: courseIds }, moduleId: null, isActive: true },
    select: { id: true, courseId: true },
  });
  if (quizzes.length === 0) return vacio;

  const intentos = await prisma.quizAttempt.findMany({
    where: {
      quizId: { in: quizzes.map((q) => q.id) },
      userId,
      moment: { not: null },
      finishedAt: { not: null },
      score: { not: null },
    },
    select: { quizId: true, moment: true },
  });

  const porQuiz = new Map<string, Set<string>>();
  for (const i of intentos) {
    const set = porQuiz.get(i.quizId) ?? new Set<string>();
    set.add(i.moment!);
    porQuiz.set(i.quizId, set);
  }

  return new Map(
    quizzes.map((q) => [
      q.courseId!,
      {
        quizId: q.id,
        presaberDone: porQuiz.get(q.id)?.has("PRESABER") ?? false,
        postsaberDone: porQuiz.get(q.id)?.has("POSTSABER") ?? false,
      },
    ])
  );
}

/** Actividad puntual con su plan (para el encabezado) y sus documentos propios (Etapa 2). */
export async function getTrainingActivityDetail(activityId: string) {
  return prisma.trainingActivity.findUnique({
    where: { id: activityId },
    include: {
      plan: { select: { id: true, title: true, tutorId: true, targetDepartment: true } },
      course: { select: { id: true, title: true, slug: true } },
      area: { select: { id: true, name: true } },
      responsibleUser: { select: { id: true, fullName: true, username: true } },
      documents: documentInclude,
      sessions: { orderBy: { startsAt: "asc" }, include: { municipio: { select: { nombre: true } } } },
    },
  });
}

/**
 * Cuánto de lo que cada área debe entregar ya está montado en la
 * plataforma: cuántas de sus capacitaciones tienen curso vinculado.
 *
 * Es el indicador más honesto que existe hoy sobre el plan: no depende de
 * inscripciones ni de quién ya vio qué -eso todavía es cero en casi todo
 * porque el contenido acaba de empezar a subirse-, depende solo de si el
 * área ya hizo su parte. Global a la institución, no se filtra por rol:
 * cualquier tutor de área ya puede leer el plan completo (Fase 3), así que
 * ver cómo van las demás no revela nada que no pueda ver entrando al plan.
 */
export async function getAreaCoverageBreakdown() {
  const areas = await prisma.trainingArea.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      tutorId: true,
      tutor: { select: { fullName: true } },
      activities: { select: { courseId: true } },
    },
  });

  return areas.map((a) => {
    const total = a.activities.length;
    const conContenido = a.activities.filter((x) => x.courseId).length;
    return {
      id: a.id,
      name: a.name,
      tutorName: a.tutor?.fullName ?? null,
      tutorId: a.tutorId,
      total,
      conContenido,
      percentage: total > 0 ? Math.round((conContenido / total) * 100) : null,
    };
  });
}

/**
 * Todas las jornadas con fecha real de un plan, para el calendario.
 *
 * A diferencia de `plan.activities`, que trae el trimestre de cada línea del
 * PIC, esto trae solo lo que ya tiene día y hora concretos -el dato que un
 * calendario de verdad necesita, y que la mayoría de líneas del plan
 * todavía no tiene-.
 */
export async function getSessionsForPlan(planId: string) {
  return prisma.trainingSession.findMany({
    where: { activity: { planId } },
    orderBy: { startsAt: "asc" },
    include: {
      activity: {
        select: { id: true, title: true, area: { select: { id: true, name: true } } },
      },
    },
  });
}

/**
 * Si esta evaluación es un ciclo presaber/postsaber, la actividad que lo
 * gobierna; si no, null y el quiz funciona exactamente como cualquier otro
 * de la plataforma.
 *
 * Solo aplica a la evaluación FINAL del curso (moduleId null): es la que
 * mide el conocimiento antes y después, no cada quiz de módulo. Y solo si
 * el curso está vinculado a una línea del plan -sin eso no hay ventanas que
 * abrir ni cerrar-.
 */
export async function getEvaluationGate(quizId: string) {
  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    select: { moduleId: true, courseId: true },
  });
  if (!quiz || quiz.moduleId !== null) return null;

  return prisma.trainingActivity.findFirst({
    where: { courseId: quiz.courseId },
    select: {
      id: true,
      status: true,
      presaberOpenedAt: true,
      presaberClosedAt: true,
      postsaberOpenedAt: true,
      postsaberClosedAt: true,
    },
  });
}

/**
 * El momento del ciclo que le corresponde a ESTA persona en ESTA evaluación,
 * resolviendo el modo automático (por defecto: presaber siempre disponible,
 * postsaber al presentar el presaber) o el manual (ventanas del área), en un
 * solo lugar para que la página, el borrador y el envío nunca discrepen.
 *
 * En modo automático una jornada CERRADA congela el ciclo: ya no hay momento.
 */
export async function getMomentoParaUsuario(quizId: string, userId: string) {
  const gate = await getEvaluationGate(quizId);
  if (!gate) return { gate: null, momento: null, automatico: false } as const;

  const automatico = cicloEsAutomatico(gate);
  if (automatico && gate.status === "CLOSED") {
    return { gate, momento: null, automatico } as const;
  }

  const prePresentado =
    (await prisma.quizAttempt.count({
      where: { quizId, userId, moment: "PRESABER", score: { not: null } },
    })) > 0;

  return { gate, momento: momentoParaPersona(gate, prePresentado), automatico } as const;
}

/**
 * Promedio presaber y promedio postsaber de una capacitación: el número que
 * el ciclo existe para producir.
 *
 * Un intento por persona por momento -el mejor puntaje, no el último ni el
 * promedio de todos sus intentos-, porque a alguien se le mide por lo mejor
 * que demostró saber en esa ventana, no por sus tropiezos previos.
 */
export async function getPresaberPostsaberSummary(activityId: string) {
  const actividad = await prisma.trainingActivity.findUnique({
    where: { id: activityId },
    select: { courseId: true },
  });
  if (!actividad?.courseId) {
    return { presaberPromedio: null, presaberCantidad: 0, postsaberPromedio: null, postsaberCantidad: 0 };
  }

  const quiz = await prisma.quiz.findFirst({
    where: { courseId: actividad.courseId, moduleId: null },
    select: { id: true },
  });
  if (!quiz) {
    return { presaberPromedio: null, presaberCantidad: 0, postsaberPromedio: null, postsaberCantidad: 0 };
  }

  const intentos = await prisma.quizAttempt.findMany({
    where: { quizId: quiz.id, moment: { not: null }, score: { not: null }, finishedAt: { not: null } },
    select: { userId: true, moment: true, score: true },
  });

  const mejorPorPersona = (momento: "PRESABER" | "POSTSABER") => {
    const mejores = new Map<string, number>();
    for (const i of intentos) {
      if (i.moment !== momento || i.score === null) continue;
      const actual = mejores.get(i.userId) ?? -1;
      if (i.score > actual) mejores.set(i.userId, i.score);
    }
    return [...mejores.values()];
  };

  const promedio = (valores: number[]) =>
    valores.length > 0 ? Math.round(valores.reduce((s, v) => s + v, 0) / valores.length) : null;

  const presaberValores = mejorPorPersona("PRESABER");
  const postsaberValores = mejorPorPersona("POSTSABER");

  return {
    presaberPromedio: promedio(presaberValores),
    presaberCantidad: presaberValores.length,
    postsaberPromedio: promedio(postsaberValores),
    postsaberCantidad: postsaberValores.length,
  };
}

/**
 * Resultados del ciclo presaber/postsaber de una capacitación, en las dos
 * lecturas que el área necesita: por PERSONA (quién mejoró y cuánto) y por
 * PREGUNTA (dónde está la dificultad).
 *
 * Por persona se toma el MEJOR intento de cada momento, el mismo criterio
 * del resumen agregado: a alguien se le mide por lo mejor que demostró en la
 * ventana. Por pregunta, el % de acierto se calcula sobre esos mismos
 * mejores intentos -no sobre todos los intentos fallidos previos-, para que
 * las dos tablas cuenten la misma historia.
 */
export async function getCycleResults(activityId: string) {
  const actividad = await prisma.trainingActivity.findUnique({
    where: { id: activityId },
    select: { courseId: true },
  });
  if (!actividad?.courseId) return null;

  const quiz = await prisma.quiz.findFirst({
    where: { courseId: actividad.courseId, moduleId: null },
    select: { id: true },
  });
  if (!quiz) return null;

  const intentos = await prisma.quizAttempt.findMany({
    where: { quizId: quiz.id, moment: { not: null }, score: { not: null }, finishedAt: { not: null } },
    select: {
      id: true,
      moment: true,
      score: true,
      user: { select: { id: true, fullName: true, documentNumber: true } },
    },
  });
  if (intentos.length === 0) return null;

  // Mejor intento por persona por momento.
  const mejores = new Map<string, { user: (typeof intentos)[number]["user"]; pre?: { id: string; score: number }; post?: { id: string; score: number } }>();
  for (const i of intentos) {
    const registro = mejores.get(i.user.id) ?? { user: i.user };
    const clave = i.moment === "PRESABER" ? "pre" : "post";
    if (!registro[clave] || i.score! > registro[clave]!.score) {
      registro[clave] = { id: i.id, score: i.score! };
    }
    mejores.set(i.user.id, registro);
  }

  const personas = [...mejores.values()]
    .map((r) => ({
      fullName: r.user.fullName,
      documentNumber: r.user.documentNumber,
      presaber: r.pre?.score ?? null,
      postsaber: r.post?.score ?? null,
      diferencia: r.pre && r.post ? r.post.score - r.pre.score : null,
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "es"));

  // Por pregunta: acierto sobre los mejores intentos de cada momento.
  const idsPre = [...mejores.values()].map((r) => r.pre?.id).filter((x): x is string => !!x);
  const idsPost = [...mejores.values()].map((r) => r.post?.id).filter((x): x is string => !!x);

  const [preguntas, respuestas] = await Promise.all([
    prisma.question.findMany({
      where: { quizId: quiz.id, isActive: true, type: { not: "OPEN_TEXT" } },
      orderBy: { sortOrder: "asc" },
      select: { id: true, statement: true },
    }),
    prisma.quizAnswer.findMany({
      where: { attemptId: { in: [...idsPre, ...idsPost] } },
      select: { attemptId: true, questionId: true, isCorrect: true },
    }),
  ]);

  const setPre = new Set(idsPre);
  const porPregunta = preguntas.map((p) => {
    const suyas = respuestas.filter((r) => r.questionId === p.id);
    const pre = suyas.filter((r) => setPre.has(r.attemptId));
    const post = suyas.filter((r) => !setPre.has(r.attemptId));
    const pct = (lista: typeof suyas) =>
      lista.length > 0 ? Math.round((lista.filter((r) => r.isCorrect).length / lista.length) * 100) : null;
    return { statement: p.statement, presaber: pct(pre), postsaber: pct(post) };
  });

  return { personas, porPregunta };
}

/**
 * Las evaluaciones del ciclo con ventana ABIERTA que le aplican a esta
 * persona, para listarlas en "Mis encuestas" e ir directo a presentarlas.
 *
 * "Disponible" aquí es literal: la ventana está abierta AHORA. El enlace de
 * cada fila es el mismo /c/... del QR, que ya resuelve inscripción y momento;
 * así esta lista y el cartel del salón llevan exactamente al mismo lugar.
 */
export async function getEvaluacionesCicloDisponibles(userId: string, personnelType: CourseAudience | null) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { department: true } });

  const actividades = await prisma.trainingActivity.findMany({
    where: {
      courseId: { not: null },
      plan: { status: "ACTIVE" },
      status: { not: "CLOSED" },
      // Ventana manual abierta, o ciclo AUTOMÁTICO (ninguna ventana tocada:
      // presaber siempre disponible, postsaber al presentar el presaber).
      OR: [
        { presaberOpenedAt: { not: null }, presaberClosedAt: null },
        { postsaberOpenedAt: { not: null }, postsaberClosedAt: null },
        { presaberOpenedAt: null, presaberClosedAt: null, postsaberOpenedAt: null, postsaberClosedAt: null },
      ],
      ...(personnelType ? { targetAudience: { in: [personnelType, "AMBOS"] } } : {}),
    },
    select: {
      id: true,
      title: true,
      courseId: true,
      presaberOpenedAt: true,
      presaberClosedAt: true,
      postsaberOpenedAt: true,
      postsaberClosedAt: true,
      area: { select: { name: true, sortOrder: true, tutor: { select: { fullName: true } } } },
      plan: { select: { title: true, targetDepartment: true } },
    },
  });

  // Mismo criterio de pertenencia que getTrainingPlanDetailForStudent: el
  // plan dirigido a una dependencia solo le aplica a quien es de ella.
  const aplicables = actividades.filter((a) => {
    if (!a.plan.targetDepartment) return true;
    return !!user.department && user.department.trim().toLowerCase() === a.plan.targetDepartment.trim().toLowerCase();
  });
  if (aplicables.length === 0) return [];

  const courseIds = aplicables.map((a) => a.courseId!);
  const quizzes = await prisma.quiz.findMany({
    where: { courseId: { in: courseIds }, moduleId: null, isActive: true },
    select: { id: true, courseId: true, timeLimitMinutes: true, passingScore: true },
  });
  const quizPorCurso = new Map(quizzes.map((q) => [q.courseId, q]));

  const intentos = await prisma.quizAttempt.findMany({
    where: { userId, quizId: { in: quizzes.map((q) => q.id) }, moment: { not: null }, score: { not: null } },
    select: { quizId: true, moment: true },
  });
  const presentados = new Set(intentos.map((i) => `${i.quizId}:${i.moment}`));

  return aplicables
    .map((a) => {
      const quiz = quizPorCurso.get(a.courseId!);
      if (!quiz) return null;
      const momento = momentoParaPersona(a, presentados.has(`${quiz.id}:PRESABER`));
      if (!momento) return null;
      return {
        activityId: a.id,
        titulo: a.title,
        area: a.area?.name ?? "Sin área",
        areaOrden: a.area?.sortOrder ?? 99,
        tutorName: a.area?.tutor?.fullName ?? null,
        planTitle: a.plan.title,
        momento,
        yaPresentado: presentados.has(`${quiz.id}:${momento}`),
        timeLimitMinutes: quiz.timeLimitMinutes,
        passingScore: quiz.passingScore,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => a.areaOrden - b.areaOrden || a.titulo.localeCompare(b.titulo, "es"));
}

/**
 * Vista del TUTOR sobre el ciclo presaber/postsaber de SUS áreas: quién está
 * presentando AHORA MISMO (intento abierto sin terminar) y quién ya terminó
 * en la ventana vigente, con su nota. Es la contraparte de
 * getEvaluacionesCicloDisponibles -esa es "entra y respóndela", esta es
 * "mira quién la está respondiendo"-: el tutor es quien ABRE la ventana, no
 * quien la presenta, así que su vista es de observación, no de acción.
 */
export async function getTutorEvaluacionesEnVivo(tutorUserId: string) {
  const areas = await prisma.trainingArea.findMany({
    where: { tutorId: tutorUserId },
    select: { id: true, name: true },
  });
  if (areas.length === 0) return [];
  const areaIds = areas.map((a) => a.id);
  const nombrePorArea = new Map(areas.map((a) => [a.id, a.name]));

  const actividades = await prisma.trainingActivity.findMany({
    where: {
      areaId: { in: areaIds },
      courseId: { not: null },
      status: { not: "CLOSED" },
      // Ventana manual abierta, o ciclo automático (sin ventanas tocadas).
      OR: [
        { presaberOpenedAt: { not: null }, presaberClosedAt: null },
        { postsaberOpenedAt: { not: null }, postsaberClosedAt: null },
        { presaberOpenedAt: null, presaberClosedAt: null, postsaberOpenedAt: null, postsaberClosedAt: null },
      ],
    },
    select: {
      id: true,
      title: true,
      areaId: true,
      planId: true,
      presaberOpenedAt: true,
      presaberClosedAt: true,
      postsaberOpenedAt: true,
      postsaberClosedAt: true,
      courseId: true,
    },
  });
  if (actividades.length === 0) return [];

  const courseIds = actividades.map((a) => a.courseId!);
  const quizzes = await prisma.quiz.findMany({
    where: { courseId: { in: courseIds }, moduleId: null, isActive: true },
    select: { id: true, courseId: true, passingScore: true },
  });
  const quizPorCurso = new Map(quizzes.map((q) => [q.courseId, q]));

  const resultado = [];
  for (const actividad of actividades) {
    const quiz = quizPorCurso.get(actividad.courseId!);
    if (!quiz) continue;
    // En modo manual solo el momento activo; en automático ambos momentos
    // conviven (cada persona va en el suyo), así que se listan los dos.
    const momentos = cicloEsAutomatico(actividad)
      ? (["PRESABER", "POSTSABER"] as const)
      : ([momentoActivo(actividad)] as const);

    for (const momento of momentos) {
    if (!momento) continue;

    const intentos = await prisma.quizAttempt.findMany({
      where: { quizId: quiz.id, moment: momento },
      select: {
        userId: true,
        score: true,
        startedAt: true,
        finishedAt: true,
        user: { select: { fullName: true, documentNumber: true } },
      },
      orderBy: { startedAt: "desc" },
    });

    // Mejor intento terminado por persona -mismo criterio que en toda la
    // plataforma-, y quién sigue con un intento abierto sin haber
    // presentado ninguno terminado todavía: eso es "presentando ahora".
    const mejorTerminado = new Map<string, (typeof intentos)[number]>();
    for (const i of intentos) {
      if (i.finishedAt && i.score !== null) {
        const actual = mejorTerminado.get(i.userId);
        if (!actual || i.score > actual.score!) mejorTerminado.set(i.userId, i);
      }
    }
    const enProgresoPorPersona = new Map<string, (typeof intentos)[number]>();
    for (const i of intentos) {
      if (!i.finishedAt && !mejorTerminado.has(i.userId) && !enProgresoPorPersona.has(i.userId)) {
        enProgresoPorPersona.set(i.userId, i);
      }
    }
    const enProgreso = [...enProgresoPorPersona.values()];

    const completados = [...mejorTerminado.values()].sort(
      (a, b) => (b.finishedAt?.getTime() ?? 0) - (a.finishedAt?.getTime() ?? 0)
    );
    const promedio =
      completados.length > 0 ? Math.round(completados.reduce((s, c) => s + c.score!, 0) / completados.length) : null;

    resultado.push({
      activityId: actividad.id,
      planId: actividad.planId,
      titulo: actividad.title,
      area: nombrePorArea.get(actividad.areaId!) ?? "Sin área",
      momento,
      passingScore: quiz.passingScore,
      enProgreso: enProgreso.map((i) => ({ fullName: i.user.fullName, startedAt: i.startedAt })),
      completados: completados.map((c) => ({
        fullName: c.user.fullName,
        documentNumber: c.user.documentNumber,
        score: c.score!,
        finishedAt: c.finishedAt!,
      })),
      promedio,
    });
    }
  }

  return resultado.sort((a, b) => a.area.localeCompare(b.area, "es") || a.titulo.localeCompare(b.titulo, "es"));
}

/**
 * Actividad EN VIVO de las evaluaciones de los CURSOS que este tutor dicta
 * (los normales de la plataforma, no solo los del plan): intentos abiertos
 * ahora mismo y los últimos terminados con su nota. Misma lógica de
 * observación que getTutorEvaluacionesEnVivo, sobre el otro universo.
 */
export async function getTutorCursosEnVivo(tutorUserId: string) {
  const hace2h = new Date(Date.now() - 2 * 3600 * 1000);
  const [enProgreso, terminados] = await Promise.all([
    prisma.quizAttempt.findMany({
      // startedAt reciente: un borrador abandonado hace días no es "presentando ahora".
      where: { quiz: { course: { tutorId: tutorUserId } }, finishedAt: null, startedAt: { gte: hace2h } },
      orderBy: { startedAt: "desc" },
      take: 10,
      select: {
        startedAt: true,
        user: { select: { fullName: true } },
        quiz: { select: { title: true, course: { select: { id: true, title: true } } } },
      },
    }),
    prisma.quizAttempt.findMany({
      where: { quiz: { course: { tutorId: tutorUserId } }, finishedAt: { not: null }, score: { not: null } },
      orderBy: { finishedAt: "desc" },
      take: 10,
      select: {
        finishedAt: true,
        score: true,
        passed: true,
        user: { select: { fullName: true } },
        quiz: { select: { title: true, course: { select: { id: true, title: true } } } },
      },
    }),
  ]);

  return {
    enProgreso: enProgreso.map((i) => ({
      fullName: i.user.fullName,
      curso: i.quiz.course.title,
      courseId: i.quiz.course.id,
      evaluacion: i.quiz.title,
      startedAt: i.startedAt,
    })),
    terminados: terminados.map((i) => ({
      fullName: i.user.fullName,
      curso: i.quiz.course.title,
      courseId: i.quiz.course.id,
      evaluacion: i.quiz.title,
      score: i.score!,
      passed: i.passed ?? false,
      finishedAt: i.finishedAt!,
    })),
  };
}

/**
 * Encuestas de opinión de las áreas del tutor con al menos una respuesta o
 * pregunta activa: mismo espíritu de observación -cuántos han respondido,
 * quiénes, no un enlace para responderla él mismo-.
 */
export async function getTutorEncuestasEnVivo(tutorUserId: string) {
  const areas = await prisma.trainingArea.findMany({ where: { tutorId: tutorUserId }, select: { id: true } });
  if (areas.length === 0) return [];
  const areaIds = areas.map((a) => a.id);

  const encuestas = await prisma.survey.findMany({
    where: { trainingActivity: { areaId: { in: areaIds } } },
    select: {
      id: true,
      title: true,
      trainingPlanId: true,
      trainingActivity: { select: { title: true } },
      _count: { select: { questions: true, responses: true } },
      responses: {
        orderBy: { submittedAt: "desc" },
        take: 5,
        select: { submittedAt: true, user: { select: { fullName: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return encuestas
    .filter((e) => e._count.questions > 0)
    .map((e) => ({
      id: e.id,
      planId: e.trainingPlanId,
      titulo: e.title,
      actividad: e.trainingActivity?.title ?? null,
      totalPreguntas: e._count.questions,
      totalRespuestas: e._count.responses,
      ultimasRespuestas: e.responses.map((r) => ({ fullName: r.user.fullName, fecha: r.submittedAt })),
    }));
}

/**
 * Historial reciente para "Mis encuestas": intentos del ciclo (presaber y
 * postsaber, con nota) y encuestas de opinión respondidas (sin nota, son de
 * opinión), unificados por fecha. Nada inventado: sin nota donde no la hay,
 * sin fecha límite donde el modelo no la tiene -las encuestas y las ventanas
 * del ciclo no cargan un deadline propio en este sistema-.
 */
export async function getHistorialEvaluaciones(userId: string, limite = 8) {
  const [intentos, respuestas] = await Promise.all([
    prisma.quizAttempt.findMany({
      where: { userId, moment: { not: null }, score: { not: null }, finishedAt: { not: null } },
      orderBy: { finishedAt: "desc" },
      take: limite,
      select: {
        finishedAt: true,
        score: true,
        passed: true,
        moment: true,
        quiz: { select: { title: true, course: { select: { title: true } } } },
      },
    }),
    prisma.surveyResponse.findMany({
      where: { userId },
      orderBy: { submittedAt: "desc" },
      take: limite,
      select: { submittedAt: true, survey: { select: { title: true } } },
    }),
  ]);

  const filas = [
    ...intentos.map((i) => ({
      titulo: i.quiz.course.title,
      tipo: i.moment as "PRESABER" | "POSTSABER",
      fecha: i.finishedAt!,
      resultado: i.score,
      aprobado: i.passed,
    })),
    ...respuestas.map((r) => ({
      titulo: r.survey.title,
      tipo: "ENCUESTA" as const,
      fecha: r.submittedAt,
      resultado: null,
      aprobado: null,
    })),
  ];

  return filas.sort((a, b) => b.fecha.getTime() - a.fecha.getTime()).slice(0, limite);
}

/** Promedio real de los intentos del ciclo (presaber/postsaber) con nota, de esta persona. Null sin datos: no se inventa un 0. */
export async function getPromedioEvaluaciones(userId: string) {
  const intentos = await prisma.quizAttempt.findMany({
    where: { userId, moment: { not: null }, score: { not: null } },
    select: { score: true },
  });
  if (intentos.length === 0) return null;
  return Math.round(intentos.reduce((s, i) => s + i.score!, 0) / intentos.length);
}

/**
 * Participantes EXTERNOS de una jornada (registrados por el enlace público
 * /invitado, sin cuenta) con sus resultados del ciclo. Población separada a
 * propósito de las métricas internas: son universos distintos y mezclarlos
 * distorsionaría la adherencia del personal propio.
 */
export async function getExternosDeActividad(activityId: string) {
  const externos = await prisma.externalParticipant.findMany({
    where: { activityId },
    orderBy: { createdAt: "asc" },
    select: {
      fullName: true,
      company: true,
      createdAt: true,
      attempts: { select: { moment: true, score: true, passed: true } },
    },
  });
  return externos.map((e) => ({
    fullName: e.fullName,
    company: e.company,
    registradoEl: e.createdAt,
    presaber: e.attempts.find((a) => a.moment === "PRESABER")?.score ?? null,
    postsaber: e.attempts.find((a) => a.moment === "POSTSABER")?.score ?? null,
  }));
}

/**
 * Todo lo que necesita el INFORME DE LA JORNADA: los indicadores completos de
 * adherencia que se habilitan al cerrar la capacitación.
 *
 * La adherencia se mide sobre el total de encuestados (quienes presentaron la
 * evaluación), no sobre el universo teórico: promedio presaber, promedio
 * postsaber, la diferencia entre ambos, y cuántos alcanzaron el mínimo del
 * curso en cada momento. Reutiliza getCycleResults como única fuente del
 * mejor-intento-por-persona: el informe y la pantalla nunca pueden decir
 * cifras distintas.
 */
export async function getActivityReportData(activityId: string) {
  const actividad = await prisma.trainingActivity.findUnique({
    where: { id: activityId },
    select: {
      title: true,
      status: true,
      closedAt: true,
      courseId: true,
      programa: true,
      quarters: true,
      targetAudienceNote: true,
      area: { select: { name: true, tutor: { select: { fullName: true } } } },
      plan: { select: { title: true } },
    },
  });
  if (!actividad?.courseId) return null;

  const [resultados, quiz, asistencia, encuestas, externos] = await Promise.all([
    getCycleResults(activityId),
    prisma.quiz.findFirst({
      where: { courseId: actividad.courseId, moduleId: null },
      select: { passingScore: true },
    }),
    prisma.trainingAttendance.findMany({
      where: { activityId, attended: true },
      select: { userId: true, user: { select: { fullName: true, documentNumber: true } }, registeredAt: true, source: true },
      orderBy: { user: { fullName: "asc" } },
    }),
    prisma.survey.findMany({
      where: { trainingActivityId: activityId },
      select: { title: true, _count: { select: { responses: true } } },
    }),
    getExternosDeActividad(activityId),
  ]);

  const passingScore = quiz?.passingScore ?? 60;
  const personas = resultados?.personas ?? [];
  const conPre = personas.filter((p) => p.presaber !== null);
  const conPost = personas.filter((p) => p.postsaber !== null);
  const promedio = (lista: (number | null)[]) => {
    const valores = lista.filter((v): v is number => v !== null);
    return valores.length > 0 ? Math.round(valores.reduce((s, v) => s + v, 0) / valores.length) : null;
  };
  const promedioPre = promedio(conPre.map((p) => p.presaber));
  const promedioPost = promedio(conPost.map((p) => p.postsaber));

  return {
    plan: actividad.plan.title,
    area: actividad.area?.name ?? null,
    responsable: actividad.area?.tutor?.fullName ?? null,
    titulo: actividad.title,
    programa: actividad.programa,
    dirigidoA: actividad.targetAudienceNote,
    status: actividad.status,
    cerradaEl: actividad.closedAt,
    passingScore,
    indicadores: {
      asistentes: asistencia.length,
      evaluadosPre: conPre.length,
      evaluadosPost: conPost.length,
      completaronCiclo: personas.filter((p) => p.presaber !== null && p.postsaber !== null).length,
      promedioPre,
      promedioPost,
      ...(promedioPre !== null && promedioPost !== null
        ? compararAdherencia(promedioPre, promedioPost)
        : { diferencia: null, variacion: null }),
      // Adherencia sobre el total de encuestados de cada momento: cuántos
      // alcanzaron el mínimo del curso llegando (pre) y saliendo (post).
      adherentesPre: conPre.filter((p) => p.presaber! >= passingScore).length,
      adherentesPost: conPost.filter((p) => p.postsaber! >= passingScore).length,
      mejoraron: personas.filter((p) => p.diferencia !== null && p.diferencia > 0).length,
    },
    personas,
    porPregunta: resultados?.porPregunta ?? [],
    asistencia: asistencia.map((a) => ({
      fullName: a.user.fullName,
      documentNumber: a.user.documentNumber,
      fecha: a.registeredAt,
      source: a.source,
    })),
    encuestas: encuestas.map((e) => ({ titulo: e.title, respuestas: e._count.responses })),
    externos,
  };
}

export type ActivityReportData = NonNullable<Awaited<ReturnType<typeof getActivityReportData>>>;

/**
 * Registra que alguien asistió, en el instante en que entra a SU evaluación.
 *
 * Es la señal de asistencia más temprana y honesta que existe: no espera a
 * que termine el curso completo -eso ya se mide aparte como adherencia de
 * aprendizaje, vía Enrollment.status-, solo confirma que la persona se
 * presentó a la capacitación que el curso desarrolla. Nadie "la registra":
 * por eso `registeredBy` queda vacío y `source` dice AUTOMATIC.
 *
 * No toca actividades ya CERRADAS: ahí la participación quedó congelada al
 * cerrar la jornada, igual que rige para el registro manual.
 */
export async function registrarAsistenciaAutomatica(courseId: string, userId: string) {
  const actividades = await prisma.trainingActivity.findMany({
    where: { courseId, status: { not: "CLOSED" } },
    select: { id: true },
  });

  for (const actividad of actividades) {
    await prisma.trainingAttendance.upsert({
      where: { activityId_userId: { activityId: actividad.id, userId } },
      update: { attended: true },
      create: { activityId: actividad.id, userId, attended: true, source: "AUTOMATIC" },
    });
  }
}

/**
 * Quién ya asistió a una capacitación CON curso vinculado: la lista nominal
 * que complementa el % agregado de `ActivityAdherencePanel`. Antes esto
 * no existía para actividades con curso -solo se veía para las de gestión
 * directa- porque no había ninguna fuente de asistencia; ahora la hay.
 */
export async function getAutomaticAttendanceRoster(activityId: string) {
  return prisma.trainingAttendance.findMany({
    where: { activityId, attended: true },
    orderBy: { registeredAt: "asc" },
    select: {
      registeredAt: true,
      source: true,
      user: { select: { id: true, fullName: true, documentNumber: true } },
    },
  });
}

/**
 * La matriz de asistencia del plan, capacitación por capacitación: quién
 * entró, quién presentó presaber, quién postsaber y quién completó el curso.
 *
 * Es EL registro que el PIC exige como evidencia ("Registro de
 * asistencia") y por eso vive en su propia pestaña, nominal: una persona
 * por fila, con chulo por cada paso del ciclo. `areaIds` acota a las áreas
 * de quien mira -un tutor de área solo ve la asistencia de lo suyo-.
 */
export async function getPlanAttendanceOverview(planId: string, areaIds: string[] | null) {
  const actividades = await prisma.trainingActivity.findMany({
    where: {
      planId,
      courseId: { not: null },
      ...(areaIds ? { areaId: { in: areaIds } } : {}),
    },
    orderBy: [{ area: { sortOrder: "asc" } }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      courseId: true,
      area: { select: { name: true } },
    },
  });
  if (actividades.length === 0) return [];

  const courseIds = actividades.map((a) => a.courseId!);
  const [asistencias, quizzes, inscripciones] = await Promise.all([
    prisma.trainingAttendance.findMany({
      where: { activityId: { in: actividades.map((a) => a.id) }, attended: true },
      select: {
        activityId: true,
        registeredAt: true,
        source: true,
        user: { select: { id: true, fullName: true, documentNumber: true } },
      },
    }),
    prisma.quiz.findMany({
      where: { courseId: { in: courseIds }, moduleId: null },
      select: { id: true, courseId: true },
    }),
    prisma.enrollment.findMany({
      where: { courseId: { in: courseIds }, status: "COMPLETED" },
      select: { courseId: true, userId: true },
    }),
  ]);

  const quizPorCurso = new Map(quizzes.map((q) => [q.courseId!, q.id]));
  const intentos = await prisma.quizAttempt.findMany({
    where: {
      quizId: { in: quizzes.map((q) => q.id) },
      moment: { not: null },
      finishedAt: { not: null },
      score: { not: null },
    },
    select: { quizId: true, moment: true, user: { select: { id: true, fullName: true, documentNumber: true } } },
  });
  const completadosPorCurso = new Map<string, Set<string>>();
  for (const e of inscripciones) {
    const set = completadosPorCurso.get(e.courseId) ?? new Set<string>();
    set.add(e.userId);
    completadosPorCurso.set(e.courseId, set);
  }

  return actividades.map((act) => {
    const quizId = quizPorCurso.get(act.courseId!);
    const suyos = intentos.filter((i) => i.quizId === quizId);
    const asistenciaSuya = asistencias.filter((x) => x.activityId === act.id);
    const completados = completadosPorCurso.get(act.courseId!) ?? new Set<string>();

    // Una fila por persona: la unión de quien asistió, quien presentó algo y
    // quien completó -alguien puede aparecer por cualquiera de las tres vías-.
    const personas = new Map<
      string,
      { fullName: string; documentNumber: string; ingreso: Date | null; presaber: boolean; postsaber: boolean; completado: boolean }
    >();
    const asegurar = (u: { id: string; fullName: string; documentNumber: string }) => {
      const p = personas.get(u.id) ?? {
        fullName: u.fullName,
        documentNumber: u.documentNumber,
        ingreso: null,
        presaber: false,
        postsaber: false,
        completado: false,
      };
      personas.set(u.id, p);
      return p;
    };
    for (const a of asistenciaSuya) asegurar(a.user).ingreso = a.registeredAt;
    for (const i of suyos) {
      const p = asegurar(i.user);
      if (i.moment === "PRESABER") p.presaber = true;
      else p.postsaber = true;
    }
    for (const [userId, p] of personas) {
      if (completados.has(userId)) p.completado = true;
    }

    return {
      activityId: act.id,
      titulo: act.title,
      area: act.area?.name ?? "Sin área",
      personas: [...personas.values()].sort((x, y) => x.fullName.localeCompare(y.fullName, "es")),
    };
  });
}

/** Municipios activos, para el selector de la jornada presencial/mixta. */
export async function getMunicipioOptions() {
  return prisma.municipio.findMany({
    where: { isActive: true },
    select: { id: true, nombre: true },
    orderBy: { nombre: "asc" },
  });
}

// ------------------------------------------------------------------
// Etapa 3: adherencia y cumplimiento
// ------------------------------------------------------------------

/**
 * Personal objetivo real de un plan/actividad/encuesta: estudiantes activos,
 * filtrados por dependencia si se definió una (null = todo el personal, sin
 * importar el área) y por tipo de personal si la audiencia no es "Ambos".
 * Fuente única reutilizada por adherencia (Etapa 3) y encuestas (Etapa 4):
 * no se duplica el criterio de "a quién va dirigido esto".
 */
export function targetAudienceUserWhere(targetDepartment: string | null, targetAudience: CourseAudience) {
  return {
    role: "STUDENT" as const,
    status: "ACTIVE" as const,
    ...(targetDepartment ? { department: { equals: targetDepartment, mode: "insensitive" as const } } : {}),
    ...(targetAudience === "AMBOS" ? {} : { personnelType: targetAudience === "ADMINISTRATIVO" ? ("ADMINISTRATIVO" as const) : ("ASISTENCIAL" as const) }),
  };
}

export async function getTargetAudienceUserIds(targetDepartment: string | null, targetAudience: CourseAudience) {
  const users = await prisma.user.findMany({
    where: targetAudienceUserWhere(targetDepartment, targetAudience),
    select: { id: true },
  });
  return users.map((u) => u.id);
}

/** Lista nominal (nombre + documento) del personal objetivo, ordenada alfabéticamente. */
export async function getTargetAudienceUsers(targetDepartment: string | null, targetAudience: CourseAudience) {
  return prisma.user.findMany({
    where: targetAudienceUserWhere(targetDepartment, targetAudience),
    select: { id: true, fullName: true, documentNumber: true },
    orderBy: { fullName: "asc" },
  });
}

export type ActivityAdherence = {
  source: "AUTOMATIC" | "MANUAL";
  totalExpected: number;
  adherentCount: number;
  percentage: number;
};

type ActivityForAdherence = {
  id: string;
  courseId: string | null;
  targetAudience: CourseAudience;
  plan: { targetDepartment: string | null };
};

/**
 * Con curso vinculado: adherencia automática desde Enrollment.status = COMPLETED
 * (sin captura manual). Sin curso (evento externo o "No aplica"): adherencia
 * desde el registro manual de asistencia (TrainingAttendance).
 */
export async function getActivityAdherence(activity: ActivityForAdherence): Promise<ActivityAdherence> {
  const userIds = await getTargetAudienceUserIds(activity.plan.targetDepartment, activity.targetAudience);
  const totalExpected = userIds.length;

  if (activity.courseId) {
    const adherentCount =
      totalExpected === 0
        ? 0
        : await prisma.enrollment.count({
            where: { courseId: activity.courseId, userId: { in: userIds }, status: "COMPLETED" },
          });
    return {
      source: "AUTOMATIC",
      totalExpected,
      adherentCount,
      percentage: totalExpected > 0 ? Math.round((adherentCount / totalExpected) * 100) : 0,
    };
  }

  const adherentCount =
    totalExpected === 0
      ? 0
      : await prisma.trainingAttendance.count({
          where: { activityId: activity.id, userId: { in: userIds }, attended: true },
        });
  return {
    source: "MANUAL",
    totalExpected,
    adherentCount,
    percentage: totalExpected > 0 ? Math.round((adherentCount / totalExpected) * 100) : 0,
  };
}

/** Lista nominal del personal objetivo con su estado de asistencia, para el registro manual. */
export async function getActivityAttendanceRoster(activity: {
  id: string;
  targetAudience: CourseAudience;
  plan: { targetDepartment: string | null };
}) {
  const [users, attendance] = await Promise.all([
    getTargetAudienceUsers(activity.plan.targetDepartment, activity.targetAudience),
    prisma.trainingAttendance.findMany({
      where: { activityId: activity.id },
      select: { userId: true, attended: true },
    }),
  ]);
  const attendedMap = new Map(attendance.map((a) => [a.userId, a.attended]));
  return users.map((u) => ({ ...u, attended: attendedMap.get(u.id) ?? false }));
}

/**
 * Lista nominal del personal objetivo con su estado de completitud, para
 * actividades con curso vinculado (Etapa 6: al cerrar la jornada, el
 * no-adherente se registra NOMINALMENTE, no solo como % agregado).
 */
export async function getActivityCompletionRoster(activity: {
  courseId: string;
  targetAudience: CourseAudience;
  plan: { targetDepartment: string | null };
}) {
  const users = await getTargetAudienceUsers(activity.plan.targetDepartment, activity.targetAudience);
  const completed = await prisma.enrollment.findMany({
    where: { courseId: activity.courseId, userId: { in: users.map((u) => u.id) }, status: "COMPLETED" },
    select: { userId: true },
  });
  const completedIds = new Set(completed.map((e) => e.userId));
  return users.map((u) => ({ ...u, completed: completedIds.has(u.id) }));
}

/** Cumplimiento del plan: promedio de adherencia entre las actividades que sí tienen audiencia objetivo. */
export async function getPlanAdherenceSummary(plan: {
  targetDepartment: string | null;
  activities: { id: string; courseId: string | null; targetAudience: CourseAudience }[];
}) {
  const perActivity = await Promise.all(
    plan.activities.map(async (activity) => ({
      activityId: activity.id,
      ...(await getActivityAdherence({ ...activity, plan: { targetDepartment: plan.targetDepartment } })),
    }))
  );
  const withAudience = perActivity.filter((a) => a.totalExpected > 0);
  const overallPercentage =
    withAudience.length > 0
      ? Math.round(withAudience.reduce((sum, a) => sum + a.percentage, 0) / withAudience.length)
      : null;
  return { perActivity, overallPercentage };
}

/** Datos para el gráfico de barras "adherencia por actividad": zip de perActivity con el título real. Sin acceso a datos, pura transformación. */
export function buildAdherenceBarData(
  activities: { id: string; title: string }[],
  perActivity: { activityId: string; percentage: number; totalExpected: number }[]
) {
  const titleById = new Map(activities.map((a) => [a.id, a.title]));
  return perActivity
    .filter((a) => a.totalExpected > 0)
    .map((a) => ({ label: titleById.get(a.activityId) ?? "Actividad", percentage: a.percentage }));
}

/** Datos para el gráfico de pastel "actividades por estado": conteo por BORRADOR/ABIERTA/CERRADA. */
export function buildActivityStatusCounts(activities: { status: TrainingActivityStatus }[]) {
  const counts = { DRAFT: 0, OPEN: 0, CLOSED: 0 };
  for (const activity of activities) counts[activity.status] += 1;
  return [
    { status: "DRAFT" as const, label: "Borrador", count: counts.DRAFT },
    { status: "OPEN" as const, label: "Abierta", count: counts.OPEN },
    { status: "CLOSED" as const, label: "Cerrada", count: counts.CLOSED },
  ];
}

/** Lista de posibles tutores responsables: TUTOR o ADMIN, igual que el selector de tutor de un curso. */
export async function getTutorOptions() {
  return prisma.user.findMany({
    where: { role: { in: ["TUTOR", "ADMIN"] }, status: "ACTIVE" },
    select: { id: true, fullName: true, role: true },
    orderBy: { fullName: "asc" },
  });
}

/** Dependencias/áreas ya en uso (User.department, texto libre): para un <datalist>, no un catálogo nuevo. */
export async function getDepartmentOptions(): Promise<string[]> {
  const rows = await prisma.user.findMany({
    where: { department: { not: null } },
    select: { department: true },
    distinct: ["department"],
    orderBy: { department: "asc" },
  });
  return rows.map((r) => r.department).filter((d): d is string => !!d && d.trim().length > 0);
}

/** Solo cursos publicados: vincular una actividad a un curso en borrador no sería alcanzable por nadie. */
export async function getLinkableCourses() {
  return prisma.course.findMany({
    where: { status: "PUBLISHED" },
    select: { id: true, title: true },
    orderBy: { title: "asc" },
  });
}

/**
 * Cursos que ESTA persona puede vincular a una capacitación del plan.
 *
 * Un ADMIN puede enganchar cualquier curso publicado, igual que siempre. Un
 * área solo puede enganchar los cursos que ella misma tutoriza: no tendría
 * sentido que el área de Calidad vinculara su línea del PIC a un curso que
 * hizo Talento Humano.
 */
export async function getLinkableCoursesForUser(role: Role, userId: string) {
  return prisma.course.findMany({
    where: { status: "PUBLISHED", ...(role === "ADMIN" ? {} : { tutorId: userId }) },
    select: { id: true, title: true },
    orderBy: { title: "asc" },
  });
}
