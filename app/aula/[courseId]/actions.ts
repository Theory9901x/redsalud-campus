"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getAulaData } from "@/lib/aula";
import { recalculateEnrollmentProgress } from "@/lib/lesson-progress";
import { registrarAuditoria } from "@/lib/audit";

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

  await registrarAuditoria({
    userId,
    action: "COMPLETE_LESSON",
    entity: "Lesson",
    entityId: lessonId,
    description: `Completó la lección «${lesson.title}» de «${aulaData.course.title}».`,
  });

  const { certificateId } = await recalculateEnrollmentProgress(aulaData.enrollment.id);

  if (certificateId) {
    await registrarAuditoria({
      userId,
      action: "ISSUE_CERT",
      entity: "Certificate",
      entityId: certificateId,
      description: `Se emitió su certificado al completar «${aulaData.course.title}».`,
    });
  }

  revalidatePath(`/aula/${courseId}`);
  revalidatePath("/inicio");
  revalidatePath("/mi-aula");

  return { certificateId };
}

/**
 * Guarda dónde quedó la persona en un video o PDF.
 *
 * Se llama con frecuencia (cada pocos segundos de reproducción), así que no
 * recalcula el avance del curso ni revalida rutas: solo escribe la posición.
 * Marcar la lección completa es otra acción distinta.
 */
export async function guardarPosicionLeccionAction(
  courseId: string,
  lessonId: string,
  segundos: number
): Promise<{ ok: boolean }> {
  const session = await auth();
  if (!session?.user) return { ok: false };
  const userId = session.user.id;

  const aulaData = await getAulaData(courseId, userId);
  if (!aulaData) return { ok: false };

  const lesson = aulaData.flattenedLessons.find((l) => l.id === lessonId);
  if (!lesson || !lesson.unlocked) return { ok: false };

  const posicion = Math.max(0, Math.floor(segundos));

  await prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    // No se toca `status`: avanzar en el video no completa la lección por sí
    // solo, y una lección ya completada no debe volver a PENDING si alguien
    // la reabre y la rebobina.
    update: { lastPositionSeconds: posicion },
    create: {
      userId,
      lessonId,
      enrollmentId: aulaData.enrollment.id,
      status: "PENDING",
      lastPositionSeconds: posicion,
    },
  });

  return { ok: true };
}
