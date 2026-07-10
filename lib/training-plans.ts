import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

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
      plan: { select: { id: true, title: true, tutorId: true } },
      course: { select: { id: true, title: true, slug: true } },
      documents: documentInclude,
    },
  });
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
