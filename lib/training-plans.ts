import { prisma } from "@/lib/prisma";
import type { Role, CourseAudience } from "@prisma/client";

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
 * Personal objetivo real de una actividad: estudiantes activos de la dependencia
 * del plan, filtrados por tipo de personal si la audiencia no es "Ambos".
 * No duplica datos: se calcula en vivo desde User (department, personnelType).
 */
async function getTargetAudienceUserIds(targetDepartment: string, targetAudience: CourseAudience) {
  const users = await prisma.user.findMany({
    where: {
      role: "STUDENT",
      status: "ACTIVE",
      department: { equals: targetDepartment, mode: "insensitive" },
      ...(targetAudience === "AMBOS" ? {} : { personnelType: targetAudience === "ADMINISTRATIVO" ? "ADMINISTRATIVO" : "ASISTENCIAL" }),
    },
    select: { id: true },
  });
  return users.map((u) => u.id);
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
  plan: { targetDepartment: string };
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
  plan: { targetDepartment: string };
}) {
  const [users, attendance] = await Promise.all([
    prisma.user.findMany({
      where: {
        role: "STUDENT",
        status: "ACTIVE",
        department: { equals: activity.plan.targetDepartment, mode: "insensitive" },
        ...(activity.targetAudience === "AMBOS"
          ? {}
          : { personnelType: activity.targetAudience === "ADMINISTRATIVO" ? "ADMINISTRATIVO" : "ASISTENCIAL" }),
      },
      select: { id: true, fullName: true, documentNumber: true },
      orderBy: { fullName: "asc" },
    }),
    prisma.trainingAttendance.findMany({
      where: { activityId: activity.id },
      select: { userId: true, attended: true },
    }),
  ]);
  const attendedMap = new Map(attendance.map((a) => [a.userId, a.attended]));
  return users.map((u) => ({ ...u, attended: attendedMap.get(u.id) ?? false }));
}

/** Cumplimiento del plan: promedio de adherencia entre las actividades que sí tienen audiencia objetivo. */
export async function getPlanAdherenceSummary(plan: {
  targetDepartment: string;
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
