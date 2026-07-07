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

  // upsert: si ya existe una inscripción CANCELLED (queda el registro para
  // historial), reactivarla en vez de chocar con la restricción única.
  await prisma.enrollment.upsert({
    where: { userId_courseId: { userId: session.user.id, courseId: course.id } },
    update: { status: "ACTIVE", enrolledAt: new Date(), completedAt: null },
    create: { userId: session.user.id, courseId: course.id, status: "ACTIVE" },
  });

  revalidatePath(`/cursos/${slug}`);
  revalidatePath("/inicio");
  return { error: null };
}
