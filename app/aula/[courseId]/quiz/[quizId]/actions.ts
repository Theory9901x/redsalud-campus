"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import type { QuestionType } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getAulaQuiz } from "@/lib/aula";
import { getEvaluationGate } from "@/lib/training-plans";
import { recalculateEnrollmentProgress } from "@/lib/lesson-progress";
import { registrarAuditoria } from "@/lib/audit";
import { momentoActivo } from "@/lib/presaber-postsaber";

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

/** La ventana presaber/postsaber se cerró entre que se abrió el formulario y se envió. */
class EvaluacionNoHabilitadaError extends Error {}

/**
 * Mensaje si la inscripción ya venció, o null si sigue vigente.
 *
 * Hoy ninguna inscripción tiene fecha límite, así que en la práctica esto
 * nunca corta. Existe para que el día que Talento Humano las asigne la regla
 * ya esté aplicada en el servidor y no haya que acordarse de añadirla.
 */
function venceEn(deadlineAt: Date | null): string | null {
  if (!deadlineAt) return null;
  if (deadlineAt.getTime() >= Date.now()) return null;
  return `El plazo para esta formación venció el ${deadlineAt.toLocaleDateString("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })}. Comunícate con Talento Humano.`;
}

/**
 * Comprueba que lo enviado tenga sentido para el tipo de pregunta.
 *
 * No basta con calificar: sin esto, un formulario manipulado podía mandar
 * tres opciones a una pregunta de selección única, o ids de opciones de otra
 * pregunta. No cambiaba el resultado -se compara contra las correctas- pero
 * quedaba guardado como respuesta del estudiante algo que la interfaz nunca
 * habría permitido componer.
 */
function opcionesValidas(
  tipo: QuestionType,
  seleccionadas: string[],
  idsDeLaPregunta: Set<string>
): boolean {
  if (seleccionadas.some((id) => !idsDeLaPregunta.has(id))) return false;
  if (new Set(seleccionadas).size !== seleccionadas.length) return false;
  if (tipo === "MULTIPLE_CHOICE") return true;
  // Única y verdadero/falso: como mucho una opción.
  return seleccionadas.length <= 1;
}

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
  const vencidaAlEnviar = venceEn(enrollment.deadlineAt);
  if (vencidaAlEnviar) return { error: vencidaAlEnviar };

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
    select: { id: true, attemptNumber: true, moment: true },
  });

  // Un intento que se abrió en una ventana presaber/postsaber solo puede
  // calificarse mientras ESA ventana siga abierta: sin esto, un envío tardío
  // registraría respuestas del postsaber bajo la etiqueta del presaber.
  if (intentoAbierto) {
    const gate = await getEvaluationGate(quizId);
    if (gate && momentoActivo(gate) !== intentoAbierto.moment) {
      return { error: "La ventana de esta evaluación ya cerró. Recarga la página." };
    }
  }

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
    const enviadas = formData.getAll(`q_${question.id}`).map(String);
    const idsDeLaPregunta = new Set(question.options.map((o) => o.id));
    if (!opcionesValidas(question.type, enviadas, idsDeLaPregunta)) {
      return { error: "Una de las respuestas no es válida para su tipo de pregunta. Vuelve a intentarlo." };
    }
    const selectedOptionIds = enviadas;
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
        // Sin borrador previo (p. ej. una evaluación de una sola pregunta
        // abierta, que nunca pasa por el guardado automático): el mismo gate
        // que ya corrió al abrir la página, verificado de nuevo aquí porque
        // pudo haber cambiado entre que la persona abrió el formulario y
        // envió la respuesta.
        const gate = await getEvaluationGate(quizId);
        const momento = gate ? momentoActivo(gate) : null;
        if (gate && !momento) throw new EvaluacionNoHabilitadaError();

        const attempt = await tx.quizAttempt.create({
          data: {
            userId,
            quizId,
            enrollmentId: enrollment.id,
            attemptNumber,
            score: scorePercent,
            passed,
            finishedAt: new Date(),
            moment: momento,
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
    if (error instanceof EvaluacionNoHabilitadaError) {
      return { error: "Esta evaluación ya no está habilitada. Recarga la página." };
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

  await registrarAuditoria({
    userId,
    action: "SUBMIT_QUIZ",
    entity: "QuizAttempt",
    entityId: quizId,
    description:
      `Envió el intento ${attemptNumber} de «${quiz.title}». ` +
      `Calificación ${scorePercent}% sobre un mínimo de ${quiz.passingScore}%: ` +
      `${passed ? "aprobó" : "no aprobó"}.`,
  });

  const { certificateId } = await recalculateEnrollmentProgress(enrollment.id);

  if (certificateId) {
    await registrarAuditoria({
      userId,
      action: "ISSUE_CERT",
      entity: "Certificate",
      entityId: certificateId,
      description: `Se emitió su certificado al completar «${aulaQuiz.course.title}».`,
    });
  }

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
