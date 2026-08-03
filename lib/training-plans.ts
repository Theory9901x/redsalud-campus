import { prisma } from "@/lib/prisma";
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
      activities: {
        // Primero lo que tiene fecha; lo programado solo por trimestre va
        // después en orden de trimestre, y el título desempata para que el
        // cronograma no cambie de orden entre recargas.
        orderBy: [{ startDate: "asc" }, { quarters: "asc" }, { title: "asc" }],
        include: {
          course: { select: { id: true, title: true, slug: true } },
          area: { select: { id: true, name: true, sortOrder: true } },
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
      presaberOpenedAt: true,
      presaberClosedAt: true,
      postsaberOpenedAt: true,
      postsaberClosedAt: true,
    },
  });
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
