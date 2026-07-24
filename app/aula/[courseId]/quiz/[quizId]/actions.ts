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
  /** Verdadero en preguntas de respuesta abierta (no cuentan al puntaje). */
  isOpen?: boolean;
  /** Texto que escribió el estudiante (solo en las abiertas). */
  textAnswer?: string;
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

  const attemptsSoFar = await prisma.quizAttempt.count({ where: { userId, quizId } });
  const attemptNumber = attemptsSoFar + 1;
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
      await tx.quizAnswer.createMany({
        data: answerRows.map((a) => ({
          attemptId: attempt.id,
          questionId: a.questionId,
          selectedOptionIds: a.selectedOptionIds,
          textAnswer: a.textAnswer,
          isCorrect: a.isCorrect,
          scoreObtained: a.scoreObtained,
        })),
      });
    });
  } catch (error) {
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
