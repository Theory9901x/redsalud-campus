"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { recalculateEnrollmentProgress } from "@/lib/lesson-progress";

export async function markLessonCompleteAction(courseId: string, lessonId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado.");

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: session.user.id, courseId } },
  });
  if (!enrollment) throw new Error("No estás inscrito en este curso.");

  await prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId: session.user.id, lessonId } },
    update: { status: "COMPLETED", completedAt: new Date() },
    create: {
      userId: session.user.id,
      lessonId,
      enrollmentId: enrollment.id,
      status: "COMPLETED",
      completedAt: new Date(),
    },
  });

  await recalculateEnrollmentProgress(enrollment.id);

  revalidatePath(`/aula/${courseId}`);
  revalidatePath("/inicio");
  revalidatePath("/mi-aula");
}
