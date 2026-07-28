"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getAulaQuiz } from "@/lib/aula";
import { recalculateEnrollmentProgress } from "@/lib/lesson-progress";

export type QuizFeedbackItem = {
  questionId: string;
  isCorrect: boolean;
  explanation: string | null;
  correctOptionIds: string[];
  /** Lo que marcó el estudiante, para resaltarlo en la revisión. */
  selectedOptionIds?: string[];
  /** Verdadero en preguntas de respuesta abierta (no cuentan al puntaje). */
  isOpen?: boolean;
  /** Texto que escribió el estudiante (solo en las abiertas). */
  textAnswer?: string;
  /** Respuesta modelo de una pregunta abierta; solo se envía DESPUÉS de calificar. */
  expectedAnswer?: string | null;
};

export type QuizSubmitState = {
  error: string | null;
  result?: {
    score: number;
    passed: boolean;
    passingScore: number;
    attemptsRemaining: number;
    feedback: QuizFeedbackItem[] | null;
    certificateId: string | null;
  };
};

/** El intento ya lo cerró otro envío en paralelo (doble clic, reintento). */
class EnvioDuplicadoError extends Error {}

export async function submitQuizAttemptAction(
  courseId: string,
  quizId: string,
  _prevState: QuizSubmitState,
  formData: FormData
): Promise<QuizSubmitState> {
  const session = await auth();
  if (!session?.user) return { error: "No autenticado." };
  const userId = session.user.id;

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (!enrollment || enrollment.status === "CANCELLED") {
    return { error: "No estás inscrito en este curso." };
  }

  const aulaQuiz = await getAulaQuiz(courseId, quizId, userId);
  if (!aulaQuiz) return { error: "Cuestionario no encontrado." };
  if (!aulaQuiz.quizSummary.unlocked) return { error: "Este cuestionario todavía está bloqueado." };
  if (aulaQuiz.quizSummary.passed) return { error: "Ya aprobaste este cuestionario." };
  if (aulaQuiz.quizSummary.attemptsRemaining <= 0) {
    return { error: "No te quedan intentos disponibles para este cuestionario." };
  }

  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: { questions: { where: { isActive: true }, include: { options: true } } },
  });
  if (!quiz || !quiz.isActive) return { error: "Cuestionario no disponible." };

  // Si el estudiante venía guardando borrador, ya existe un intento en curso:
  // hay que CERRARLO, no abrir otro. Crear uno nuevo gastaría dos intentos por
  // una sola evaluación.
  const intentoAbierto = await prisma.quizAttempt.findFirst({
    where: { userId, quizId, finishedAt: null },
    select: { id: true, attemptNumber: true },
  });

  const attemptsSoFar = await prisma.quizAttempt.count({ where: { userId, quizId } });
  const attemptNumber = intentoAbierto?.attemptNumber ?? attemptsSoFar + 1;
  if (attemptNumber > quiz.maxAttempts) {
    return { error: "No te quedan intentos disponibles para este cuestionario." };
  }

  let totalScore = 0;
  let maxScore = 0;
  const answerRows: {
    questionId: string;
    selectedOptionIds: string[];
    textAnswer: string | null;
    isCorrect: boolean;
    scoreObtained: number;
  }[] = [];
  const feedback: QuizFeedbackItem[] = [];

  for (const question of quiz.questions) {
    // Respuesta abierta: se guarda el texto para revisión, pero NO cuenta al
    // puntaje automático (no suma a maxScore). Así el 60% se calcula solo sobre
    // las auto-calificables.
    if (question.type === "OPEN_TEXT") {
      const textAnswer = String(formData.get(`q_${question.id}_text`) ?? "").trim();
      answerRows.push({ questionId: question.id, selectedOptionIds: [], textAnswer, isCorrect: false, scoreObtained: 0 });
      feedback.push({
        questionId: question.id,
        isCorrect: false,
        isOpen: true,
        textAnswer,
        expectedAnswer: question.expectedAnswer,
        explanation: question.explanation,
        correctOptionIds: [],
      });
      continue;
    }

    maxScore += question.score;
    const selectedOptionIds = formData.getAll(`q_${question.id}`).map(String);
    const correctOptionIds = question.options.filter((o) => o.isCorrect).map((o) => o.id);

    let isCorrect: boolean;
    if (question.type === "MULTIPLE_CHOICE") {
      const selectedSet = new Set(selectedOptionIds);
      const correctSet = new Set(correctOptionIds);
      isCorrect = selectedSet.size === correctSet.size && [...selectedSet].every((id) => correctSet.has(id));
    } else {
      isCorrect =
        selectedOptionIds.length === 1 && correctOptionIds.length === 1 && selectedOptionIds[0] === correctOptionIds[0];
    }

    const scoreObtained = isCorrect ? question.score : 0;
    totalScore += scoreObtained;

    answerRows.push({ questionId: question.id, selectedOptionIds, textAnswer: null, isCorrect, scoreObtained });
    feedback.push({
      questionId: question.id,
      isCorrect,
      selectedOptionIds,
      explanation: question.explanation,
      correctOptionIds,
    });
  }

  // Sin preguntas auto-calificables (todas abiertas) no hay nada que reprobar:
  // se da por aprobado. Con al menos una, el porcentaje es sobre esas.
  const scorePercent = maxScore === 0 ? 100 : Math.round((totalScore / maxScore) * 100);
  const passed = scorePercent >= quiz.passingScore;

  try {
    await prisma.$transaction(async (tx) => {
      let attemptId: string;

      if (intentoAbierto) {
        // updateMany con finishedAt null en el WHERE: si otro envío simultáneo
        // ya lo cerró, este actualiza 0 filas y se sabe que llegó tarde, en vez
        // de sobrescribir un resultado ya calificado.
        const cerrado = await tx.quizAttempt.updateMany({
          where: { id: intentoAbierto.id, finishedAt: null },
          data: { score: scorePercent, passed, finishedAt: new Date() },
        });
        if (cerrado.count === 0) throw new EnvioDuplicadoError();
        attemptId = intentoAbierto.id;
        // Las del borrador se reemplazan por las calificadas.
        await tx.quizAnswer.deleteMany({ where: { attemptId } });
      } else {
        const attempt = await tx.quizAttempt.create({
          data: {
            userId,
            quizId,
            enrollmentId: enrollment.id,
            attemptNumber,
            score: scorePercent,
            passed,
            finishedAt: new Date(),
          },
        });
        attemptId = attempt.id;
      }

      await tx.quizAnswer.createMany({
        data: answerRows.map((a) => ({
          attemptId,
          questionId: a.questionId,
          selectedOptionIds: a.selectedOptionIds,
          textAnswer: a.textAnswer,
          isCorrect: a.isCorrect,
          scoreObtained: a.scoreObtained,
        })),
      });
    });
  } catch (error) {
    if (error instanceof EnvioDuplicadoError) {
      return { error: "Esta evaluación ya se envió. Recarga la página para ver tu resultado." };
    }
    // Un doble envío (doble clic, reintento de red) puede pasar el chequeo de
    // intentos restantes de arriba antes de que el otro confirme su insert.
    // La restricción única (userId, quizId, attemptNumber) hace perder al más
    // lento con P2002: para el usuario, es simplemente que ya no le quedan intentos.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "No te quedan intentos disponibles para este cuestionario." };
    }
    throw error;
  }

  const { certificateId } = await recalculateEnrollmentProgress(enrollment.id);

  // OJO: no revalidar la propia página del quiz aquí. Next.js refresca el
  // segmento actual tras un Server Action que llama revalidatePath sobre esa
  // misma ruta, y eso reemplazaría la pantalla de resultado (con el
  // detalle de respuestas) por el estado "ya aprobado" antes de que el
  // estudiante llegue a verla. Solo se revalida el resto de la navegación.
  revalidatePath(`/aula/${courseId}`);
  revalidatePath("/inicio");
  revalidatePath("/mi-aula");

  return {
    error: null,
    result: {
      score: scorePercent,
      passed,
      passingScore: quiz.passingScore,
      attemptsRemaining: Math.max(0, quiz.maxAttempts - attemptNumber),
      feedback: quiz.showResultsNow ? feedback : null,
      certificateId,
    },
  };
}

/**
 * Guarda una respuesta del borrador mientras el estudiante responde.
 *
 * El borrador vive en el SERVIDOR, no en localStorage: quien empieza la
 * evaluación en el computador de la sede tiene que poder terminarla en otro
 * equipo, y una respuesta guardada solo en el navegador se pierde con el
 * historial o al cambiar de máquina.
 *
 * El intento se crea con la PRIMERA respuesta, no al abrir la página: entrar
 * a mirar la evaluación no debe gastar un intento.
 */
export async function guardarRespuestaBorradorAction(
  courseId: string,
  quizId: string,
  questionId: string,
  datos: { selectedOptionIds?: string[]; textAnswer?: string | null; flagged?: boolean }
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "No autenticado." };
  const userId = session.user.id;

  const aulaQuiz = await getAulaQuiz(courseId, quizId, userId);
  if (!aulaQuiz) return { ok: false, error: "Cuestionario no encontrado." };
  if (!aulaQuiz.quizSummary.unlocked) return { ok: false, error: "Este cuestionario está bloqueado." };
  if (aulaQuiz.quizSummary.passed) return { ok: false, error: "Ya aprobaste este cuestionario." };

  // La pregunta tiene que pertenecer a ESTE cuestionario: sin esta
  // comprobación, un id manipulado podría escribir sobre otra evaluación.
  const pregunta = await prisma.question.findFirst({
    where: { id: questionId, quizId, isActive: true },
    select: { id: true },
  });
  if (!pregunta) return { ok: false, error: "Pregunta no encontrada." };

  const abierto = await prisma.quizAttempt.findFirst({
    where: { userId, quizId, finishedAt: null },
    select: { id: true },
  });

  let attemptId = abierto?.id;
  if (!attemptId) {
    if (aulaQuiz.quizSummary.attemptsRemaining <= 0) {
      return { ok: false, error: "No te quedan intentos disponibles." };
    }
    const usados = await prisma.quizAttempt.count({ where: { userId, quizId } });
    try {
      const nuevo = await prisma.quizAttempt.create({
        data: {
          userId,
          quizId,
          enrollmentId: aulaQuiz.enrollment.id,
          attemptNumber: usados + 1,
          // score y passed quedan nulos: el intento está en curso, todavía no
          // se ha calificado nada.
        },
        select: { id: true },
      });
      attemptId = nuevo.id;
    } catch (error) {
      // Dos guardados casi simultáneos pueden intentar crear el mismo número
      // de intento; el perdedor reutiliza el que acaba de ganar.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existente = await prisma.quizAttempt.findFirst({
          where: { userId, quizId, finishedAt: null },
          select: { id: true },
        });
        if (!existente) return { ok: false, error: "No se pudo iniciar el intento." };
        attemptId = existente.id;
      } else {
        throw error;
      }
    }
  }

  // isCorrect y scoreObtained quedan en cero: son del borrador, no de una
  // calificación. Se recalculan al enviar, en el servidor.
  await prisma.quizAnswer.upsert({
    where: { attemptId_questionId: { attemptId, questionId } },
    update: {
      ...(datos.selectedOptionIds !== undefined ? { selectedOptionIds: datos.selectedOptionIds } : {}),
      ...(datos.textAnswer !== undefined ? { textAnswer: datos.textAnswer } : {}),
      ...(datos.flagged !== undefined ? { flagged: datos.flagged } : {}),
    },
    create: {
      attemptId,
      questionId,
      selectedOptionIds: datos.selectedOptionIds ?? [],
      textAnswer: datos.textAnswer ?? null,
      flagged: datos.flagged ?? false,
      isCorrect: false,
      scoreObtained: 0,
    },
  });

  return { ok: true };
}
