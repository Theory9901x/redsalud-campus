"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";

export type AssignEnrollmentState = { error: string | null; success?: boolean };

export async function assignEnrollmentsAction(
  _prevState: AssignEnrollmentState,
  formData: FormData
): Promise<AssignEnrollmentState> {
  await requireAdmin();

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

  revalidatePath("/admin/inscripciones");
  return { error: null, success: true };
}

export async function cancelEnrollmentAction(enrollmentId: string) {
  await requireAdmin();
  await prisma.enrollment.update({
    where: { id: enrollmentId },
    data: { status: "CANCELLED" },
  });
  revalidatePath("/admin/inscripciones");
}

export async function reactivateEnrollmentAction(enrollmentId: string) {
  await requireAdmin();
  // Solo tiene sentido reactivar una inscripción CANCELLED; una ya COMPLETED
  // o FAILED no debe volver a ACTIVE (desincronizaría el certificado ya emitido).
  await prisma.enrollment.updateMany({
    where: { id: enrollmentId, status: "CANCELLED" },
    data: { status: "ACTIVE", enrolledAt: new Date(), completedAt: null },
  });
  revalidatePath("/admin/inscripciones");
}
