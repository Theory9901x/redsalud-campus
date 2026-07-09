"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getAulaData } from "@/lib/aula";
import { recalculateEnrollmentProgress } from "@/lib/lesson-progress";

export async function markLessonCompleteAction(
  courseId: string,
  lessonId: string
): Promise<{ certificateId: string | null }> {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado.");
  const userId = session.user.id;

  const aulaData = await getAulaData(courseId, userId);
  if (!aulaData) throw new Error("No estás inscrito en este curso.");

  const lesson = aulaData.flattenedLessons.find((l) => l.id === lessonId);
  if (!lesson) throw new Error("Lección no encontrada.");
  if (!lesson.unlocked) throw new Error("Esta lección todavía está bloqueada.");

  await prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    update: { status: "COMPLETED", completedAt: new Date() },
    create: {
      userId,
      lessonId,
      enrollmentId: aulaData.enrollment.id,
      status: "COMPLETED",
      completedAt: new Date(),
    },
  });

  const { certificateId } = await recalculateEnrollmentProgress(aulaData.enrollment.id);

  revalidatePath(`/aula/${courseId}`);
  revalidatePath("/inicio");
  revalidatePath("/mi-aula");

  return { certificateId };
}
