"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/audit";
import { recalculateEnrollmentProgress } from "@/lib/lesson-progress";

/**
 * Herramientas de prueba del administrador sobre SU PROPIO avance.
 *
 * Existen porque probar el recorrido del estudiante de punta a punta -ver el
 * desbloqueo secuencial, la nota de repaso, el aviso del certificado- exige
 * poder volver al principio, y sin esto había que borrar filas a mano contra
 * la base de datos de producción.
 *
 * Dos límites deliberados:
 *
 *  - Solo actúan sobre quien las ejecuta. No hay forma de reiniciar ni
 *    completar el curso de otra persona desde aquí; eso sería una operación
 *    sobre expedientes de terceros y no una herramienta de prueba.
 *  - Solo para ADMIN, comprobado en el servidor. Que el botón no se pinte
 *    para un estudiante no protege nada por sí solo.
 *
 * Todo queda en la bitácora: son cambios reales sobre datos de formación, y
 * tienen que poder distinguirse después de un avance genuino.
 */

type Resultado = { error: string | null; mensaje?: string; certificateId?: string | null };

/** Campo `ok` como discriminante: es lo que permite a TypeScript estrechar. */
type Contexto =
  | { ok: false; error: string }
  | { ok: true; userId: string; enrollmentId: string };

async function contexto(courseId: string): Promise<Contexto> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "No autenticado." };
  if (session.user.role !== "ADMIN") {
    return { ok: false, error: "Solo un administrador puede usar esto." };
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: session.user.id, courseId } },
    select: { id: true },
  });
  if (!enrollment) return { ok: false, error: "No estás inscrito en este curso." };

  return { ok: true, userId: session.user.id, enrollmentId: enrollment.id };
}

/** Devuelve el curso al punto de partida: sin avance, sin intentos, sin certificado. */
export async function reiniciarMiCursoAction(courseId: string): Promise<Resultado> {
  const ctx = await contexto(courseId);
  if (!ctx.ok) return { error: ctx.error };
  const { userId, enrollmentId } = ctx;

  const curso = await prisma.course.findUnique({ where: { id: courseId }, select: { title: true } });

  await prisma.$transaction([
    prisma.lessonProgress.deleteMany({ where: { userId, lesson: { module: { courseId } } } }),
    // Los intentos arrastran sus respuestas por cascada.
    prisma.quizAttempt.deleteMany({ where: { userId, quiz: { courseId } } }),
    // El certificado se va también: si no, al volver a completar el curso no
    // habría nada nuevo que emitir y no se vería el aviso, que es justo lo
    // que se quiere probar.
    prisma.certificate.deleteMany({ where: { enrollmentId } }),
    prisma.enrollment.update({
      where: { id: enrollmentId },
      data: { status: "ACTIVE", progressPercentage: 0, finalScore: null, completedAt: null, startedAt: null },
    }),
  ]);

  await registrarAuditoria({
    userId,
    action: "DELETE",
    entity: "Enrollment",
    entityId: enrollmentId,
    description: `Reinició su propio avance en «${curso?.title ?? courseId}» como prueba de administrador.`,
  });

  revalidatePath(`/aula/${courseId}`);
  revalidatePath("/inicio");
  revalidatePath("/mi-aula");
  revalidatePath("/cursos");

  return { error: null, mensaje: "Curso reiniciado. Vuelves a empezar desde cero." };
}

/**
 * Deja el curso terminado: todas las lecciones vistas y todas las
 * evaluaciones aprobadas, para llegar al certificado sin recorrerlo entero.
 *
 * Los intentos que crea son reales y quedan marcados como aprobados al 100 %.
 * No se falsean respuestas: se registra el intento, que es lo que el cálculo
 * de avance mira.
 */
export async function completarMiCursoAction(courseId: string): Promise<Resultado> {
  const ctx = await contexto(courseId);
  if (!ctx.ok) return { error: ctx.error };
  const { userId, enrollmentId } = ctx;

  const [curso, lecciones, quizzes] = await Promise.all([
    prisma.course.findUnique({ where: { id: courseId }, select: { title: true } }),
    prisma.lesson.findMany({
      where: { isActive: true, module: { courseId, isActive: true } },
      select: { id: true },
    }),
    prisma.quiz.findMany({ where: { courseId, isActive: true }, select: { id: true, passingScore: true } }),
  ]);

  for (const l of lecciones) {
    await prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId: l.id } },
      update: { status: "COMPLETED", completedAt: new Date() },
      create: { userId, lessonId: l.id, enrollmentId, status: "COMPLETED", completedAt: new Date() },
    });
  }

  for (const q of quizzes) {
    const yaAprobado = await prisma.quizAttempt.findFirst({
      where: { userId, quizId: q.id, passed: true },
      select: { id: true },
    });
    if (yaAprobado) continue;

    // Un intento abierto se reutiliza; si no, se numera a continuación.
    const abierto = await prisma.quizAttempt.findFirst({
      where: { userId, quizId: q.id, finishedAt: null },
      select: { id: true },
    });
    if (abierto) {
      await prisma.quizAttempt.update({
        where: { id: abierto.id },
        data: { score: 100, passed: true, finishedAt: new Date() },
      });
    } else {
      const usados = await prisma.quizAttempt.count({ where: { userId, quizId: q.id } });
      await prisma.quizAttempt.create({
        data: {
          userId,
          quizId: q.id,
          enrollmentId,
          attemptNumber: usados + 1,
          score: 100,
          passed: true,
          finishedAt: new Date(),
        },
      });
    }
  }

  const { certificateId } = await recalculateEnrollmentProgress(enrollmentId);

  await registrarAuditoria({
    userId,
    action: "UPDATE",
    entity: "Enrollment",
    entityId: enrollmentId,
    description: `Completó su propio avance en «${curso?.title ?? courseId}» como prueba de administrador (${lecciones.length} lecciones, ${quizzes.length} evaluaciones).`,
  });

  revalidatePath(`/aula/${courseId}`);
  revalidatePath("/inicio");
  revalidatePath("/mi-aula");
  revalidatePath("/cursos");

  return {
    error: null,
    mensaje: "Curso completado.",
    certificateId,
  };
}
