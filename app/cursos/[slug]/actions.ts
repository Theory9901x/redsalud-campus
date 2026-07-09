"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type EnrollState = { error: string | null };

export async function enrollInCourseAction(
  courseId: string,
  slug: string,
  _prevState: EnrollState,
  _formData: FormData
): Promise<EnrollState> {
  const session = await auth();
  if (!session?.user) {
    return { error: "Debes iniciar sesión para inscribirte." };
  }

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course || course.status !== "PUBLISHED") {
    return { error: "Este curso no está disponible." };
  }
  if (course.enrollmentMode !== "OPEN") {
    return { error: "Este curso requiere que un administrador te asigne." };
  }

  const existing = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: session.user.id, courseId: course.id } },
  });

  if (existing && existing.status !== "CANCELLED") {
    // Ya inscrito (ACTIVE/COMPLETED/FAILED): no-op idempotente, para no desincronizar
    // el progreso o el certificado ya emitido ante un reenvío duplicado del formulario.
    revalidatePath(`/cursos/${slug}`);
    revalidatePath("/inicio");
    return { error: null };
  }

  if (existing) {
    // Solo se reactiva una inscripción CANCELLED previa; nunca una ya completada.
    await prisma.enrollment.update({
      where: { id: existing.id },
      data: { status: "ACTIVE", enrolledAt: new Date(), completedAt: null },
    });
  } else {
    await prisma.enrollment.create({
      data: { userId: session.user.id, courseId: course.id, status: "ACTIVE" },
    });
  }

  revalidatePath(`/cursos/${slug}`);
  revalidatePath("/inicio");
  return { error: null };
}
