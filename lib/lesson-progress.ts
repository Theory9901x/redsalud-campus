import { prisma } from "@/lib/prisma";
import { issueCertificateIfEligible } from "@/lib/certificates";

/**
 * Recalcula el avance y estado de una inscripción: el porcentaje se basa en
 * lecciones obligatorias completadas, pero la finalización del curso exige
 * además que todos los cuestionarios activos estén aprobados. Si un
 * cuestionario agota sus intentos sin aprobarse, el curso queda reprobado.
 * `finalScore` es el promedio de los mejores puntajes aprobados de cada quiz.
 */
export async function recalculateEnrollmentProgress(
  enrollmentId: string
): Promise<{ certificateId: string | null }> {
  const enrollment = await prisma.enrollment.findUniqueOrThrow({
    where: { id: enrollmentId },
    select: { id: true, userId: true, courseId: true, status: true, startedAt: true },
  });

  if (enrollment.status === "CANCELLED") return { certificateId: null };

  const [totalRequired, completedRequired, quizzes] = await Promise.all([
    prisma.lesson.count({
      where: { isRequired: true, isActive: true, module: { courseId: enrollment.courseId, isActive: true } },
    }),
    prisma.lessonProgress.count({
      where: {
        userId: enrollment.userId,
        status: "COMPLETED",
        lesson: {
          isRequired: true,
          isActive: true,
          module: { courseId: enrollment.courseId, isActive: true },
        },
      },
    }),
    prisma.quiz.findMany({
      where: { courseId: enrollment.courseId, isActive: true },
      select: { id: true, maxAttempts: true },
    }),
  ]);

  const progressPercentage = totalRequired === 0 ? 100 : Math.round((completedRequired / totalRequired) * 100);
  const lessonsComplete = completedRequired >= totalRequired;

  let quizzesComplete = true;
  let quizExhausted = false;
  const passedScores: number[] = [];

  if (quizzes.length > 0) {
    const attempts = await prisma.quizAttempt.findMany({
      where: { userId: enrollment.userId, quizId: { in: quizzes.map((q) => q.id) } },
      select: { quizId: true, score: true, passed: true },
    });

    for (const quiz of quizzes) {
      const quizAttempts = attempts.filter((a) => a.quizId === quiz.id);
      const passedAttempt = quizAttempts.find((a) => a.passed === true);
      if (passedAttempt) {
        passedScores.push(passedAttempt.score!);
      } else {
        quizzesComplete = false;
        if (quizAttempts.length >= quiz.maxAttempts) quizExhausted = true;
      }
    }
  }

  const isNowComplete = lessonsComplete && quizzesComplete;
  const isNowFailed = lessonsComplete && !quizzesComplete && quizExhausted;
  const finalScore = passedScores.length > 0 ? Math.round(passedScores.reduce((a, b) => a + b, 0) / passedScores.length) : null;

  const estabaCompleta = enrollment.status === "COMPLETED";

  /*
   * Una inscripción marcada COMPLETED vuelve a ACTIVE si el curso creció.
   *
   * Antes el estado solo avanzaba: quien terminaba una versión del curso
   * seguía "completado al 100 %" aunque después se añadieran módulos. Pasó de
   * verdad al montar los contenidos nuevos: había gente con 3 de 14 lecciones
   * contada como completada, y el panel de Talento Humano la sumaba así.
   *
   * Y tenía una segunda consecuencia peor: como el estado ya era COMPLETED,
   * al terminar el curso de verdad no había transición y NO se anunciaba el
   * certificado. El aviso dependía de un cambio de estado que nunca ocurría.
   *
   * El certificado ya emitido no se toca: se ganó con lo que había entonces.
   */
  const reabrir = !isNowComplete && estabaCompleta;
  const justCompleted = isNowComplete && !estabaCompleta;

  await prisma.enrollment.update({
    where: { id: enrollmentId },
    data: {
      progressPercentage,
      startedAt: enrollment.startedAt ?? new Date(),
      ...(finalScore !== null ? { finalScore } : {}),
      ...(justCompleted ? { status: "COMPLETED", completedAt: new Date() } : {}),
      ...(reabrir ? { status: "ACTIVE", completedAt: null } : {}),
      ...(isNowFailed && enrollment.status === "ACTIVE" ? { status: "FAILED", completedAt: new Date() } : {}),
    },
  });

  // El certificado se asegura siempre que el curso esté completo, no solo en
  // el instante de la transición: si por lo que sea faltaba, aquí aparece.
  if (isNowComplete) {
    const yaTenia = await prisma.certificate.findUnique({
      where: { enrollmentId },
      select: { id: true },
    });
    const certificateId = await issueCertificateIfEligible(enrollmentId);
    // Se anuncia cuando acaba de completarse o cuando el certificado es nuevo.
    return { certificateId: justCompleted || !yaTenia ? certificateId : null };
  }

  return { certificateId: null };
}
