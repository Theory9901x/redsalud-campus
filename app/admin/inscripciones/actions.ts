"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { registrarAuditoria } from "@/lib/audit";
import type { Prisma, PersonnelType, TipoVinculacion } from "@prisma/client";

export type AssignEnrollmentState = { error: string | null; success?: boolean };

/**
 * Filtros de audiencia para asignación masiva. Deliberadamente NO incluyen la
 * lista de personas: el panel de Inscripciones no vuelve a traer el padrón de
 * estudiantes al navegador (288 personas iban al cliente para pintar un
 * checklist), solo criterios que Postgres resuelve con un COUNT o un
 * findMany-de-ids que nunca sale del servidor.
 */
export type StudentFilters = {
  municipioId?: string;
  tipoVinculacion?: TipoVinculacion;
  personnelType?: PersonnelType;
  q?: string;
};

function studentFilterWhere(f: StudentFilters): Prisma.UserWhereInput {
  return {
    role: "STUDENT",
    status: "ACTIVE",
    ...(f.municipioId ? { municipioId: f.municipioId } : {}),
    ...(f.tipoVinculacion ? { tipoVinculacion: f.tipoVinculacion } : {}),
    ...(f.personnelType ? { personnelType: f.personnelType } : {}),
    ...(f.q?.trim()
      ? {
          OR: [
            { fullName: { contains: f.q.trim(), mode: "insensitive" as const } },
            { documentNumber: { contains: f.q.trim(), mode: "insensitive" as const } },
            { email: { contains: f.q.trim(), mode: "insensitive" as const } },
            { username: { contains: f.q.trim(), mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
}

/** Cuántas personas coinciden con el filtro vigente, para mostrarlo antes de asignar. Nunca devuelve la lista. */
export async function countStudentsMatchingAction(filters: StudentFilters): Promise<number> {
  await requireAdmin();
  return prisma.user.count({ where: studentFilterWhere(filters) });
}

/**
 * Asigna un curso a TODA la audiencia que resuelva el filtro, en un solo
 * viaje a la base (createMany/updateMany), sin que el navegador reciba en
 * ningún momento el padrón de personas. Reemplaza la selección manual
 * persona-por-persona del panel de Inscripciones, que traía las 288 cuentas
 * activas al cliente para un checklist y era justo lo que lo hacía lento.
 */
export async function assignEnrollmentsByFilterAction(
  courseId: string,
  filters: StudentFilters,
  filterDescription: string
): Promise<AssignEnrollmentState & { assignedCount?: number }> {
  const sesion = await requireAdmin();

  if (!courseId) return { error: "Selecciona un curso." };

  const students = await prisma.user.findMany({ where: studentFilterWhere(filters), select: { id: true } });
  if (students.length === 0) return { error: "Ningún estudiante activo coincide con ese filtro." };

  const studentIds = students.map((s) => s.id);

  const existing = await prisma.enrollment.findMany({
    where: { courseId, userId: { in: studentIds } },
    select: { userId: true, status: true },
  });
  const existingByUser = new Map(existing.map((e) => [e.userId, e.status]));

  const toCreate = studentIds.filter((userId) => !existingByUser.has(userId));
  const toReactivate = studentIds.filter((userId) => existingByUser.get(userId) === "CANCELLED");

  await Promise.all([
    toCreate.length > 0
      ? prisma.enrollment.createMany({
          data: toCreate.map((userId) => ({ userId, courseId, status: "ACTIVE" as const })),
        })
      : null,
    toReactivate.length > 0
      ? prisma.enrollment.updateMany({
          where: { courseId, userId: { in: toReactivate } },
          data: { status: "ACTIVE", enrolledAt: new Date(), completedAt: null },
        })
      : null,
  ]);
  // Si ya está ACTIVE, COMPLETED o FAILED, se deja tal cual.

  await registrarAuditoria({
    userId: sesion.user.id,
    action: "ENROLL",
    entity: "Enrollment",
    entityId: courseId,
    description: `Inscribió ${studentIds.length} ${studentIds.length === 1 ? "persona" : "personas"} en un curso por filtro (${filterDescription})`,
  });

  // Las páginas de ficha de usuario son dinámicas (leen sesión y BD en cada
  // petición): revalidarlas una por una no cambia lo que devuelven y, con un
  // filtro que puede alcanzar a cientos de personas, sería trabajo puro.
  revalidatePath("/admin/inscripciones");
  return { error: null, success: true, assignedCount: studentIds.length };
}

export async function assignEnrollmentsAction(
  _prevState: AssignEnrollmentState,
  formData: FormData
): Promise<AssignEnrollmentState> {
  const sesion = await requireAdmin();

  const courseId = formData.get("courseId");
  const studentIds = formData.getAll("studentIds").map(String);

  if (typeof courseId !== "string" || !courseId) {
    return { error: "Selecciona un curso." };
  }
  if (studentIds.length === 0) {
    return { error: "Selecciona al menos un estudiante." };
  }

  const existing = await prisma.enrollment.findMany({
    where: { courseId, userId: { in: studentIds } },
    select: { userId: true, status: true },
  });
  const existingByUser = new Map(existing.map((e) => [e.userId, e.status]));

  // Antes esto hacía un create/update por estudiante (round trip por uno a
  // la BD remota, muy lento con 20-30 seleccionados). Se agrupa en un solo
  // createMany y un solo updateMany.
  const toCreate = studentIds.filter((userId) => !existingByUser.has(userId));
  const toReactivate = studentIds.filter((userId) => existingByUser.get(userId) === "CANCELLED");

  await Promise.all([
    toCreate.length > 0
      ? prisma.enrollment.createMany({
          data: toCreate.map((userId) => ({ userId, courseId, status: "ACTIVE" as const })),
        })
      : null,
    toReactivate.length > 0
      ? prisma.enrollment.updateMany({
          where: { courseId, userId: { in: toReactivate } },
          data: { status: "ACTIVE", enrolledAt: new Date(), completedAt: null },
        })
      : null,
  ]);
  // Si ya está ACTIVE, COMPLETED o FAILED, se deja tal cual.

  await registrarAuditoria({
    userId: sesion.user.id,
    action: "ENROLL",
    entity: "Enrollment",
    entityId: courseId,
    description: `Inscribió ${studentIds.length} ${studentIds.length === 1 ? "persona" : "personas"} en un curso`,
  });

  revalidatePath("/admin/inscripciones");
  for (const userId of studentIds) revalidatePath(`/admin/usuarios/${userId}`);
  return { error: null, success: true };
}

export async function cancelEnrollmentAction(enrollmentId: string) {
  const sesion = await requireAdmin();
  const enrollment = await prisma.enrollment.update({
    where: { id: enrollmentId },
    data: { status: "CANCELLED" },
  });
  await registrarAuditoria({
    userId: sesion.user.id,
    action: "UNENROLL",
    entity: "Enrollment",
    entityId: enrollmentId,
    description: "Canceló una inscripción",
  });

  revalidatePath("/admin/inscripciones");
  revalidatePath(`/admin/usuarios/${enrollment.userId}`);
}

export async function reactivateEnrollmentAction(enrollmentId: string) {
  await requireAdmin();
  // Solo tiene sentido reactivar una inscripción CANCELLED; una ya COMPLETED
  // o FAILED no debe volver a ACTIVE (desincronizaría el certificado ya emitido).
  const enrollment = await prisma.enrollment.findUniqueOrThrow({ where: { id: enrollmentId } });
  await prisma.enrollment.updateMany({
    where: { id: enrollmentId, status: "CANCELLED" },
    data: { status: "ACTIVE", enrolledAt: new Date(), completedAt: null },
  });
  revalidatePath("/admin/inscripciones");
  revalidatePath(`/admin/usuarios/${enrollment.userId}`);
}
