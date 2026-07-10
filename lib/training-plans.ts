import { prisma } from "@/lib/prisma";
import type { Role, CourseAudience, TrainingActivityStatus } from "@prisma/client";

/** ADMIN ve todos los planes; TUTOR solo los suyos. Una sola vista, alcance por rol. */
export function trainingPlanScopeWhere(role: Role, userId: string) {
  return role === "ADMIN" ? {} : { tutorId: userId };
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
        orderBy: { startDate: "asc" },
        include: { course: { select: { id: true, title: true, slug: true } } },
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

/** Actividad puntual con su plan (para el encabezado) y sus documentos propios (Etapa 2). */
export async function getTrainingActivityDetail(activityId: string) {
  return prisma.trainingActivity.findUnique({
    where: { id: activityId },
    include: {
      plan: { select: { id: true, title: true, tutorId: true, targetDepartment: true } },
      course: { select: { id: true, title: true, slug: true } },
      documents: documentInclude,
    },
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
