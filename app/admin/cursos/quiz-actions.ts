"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { saveQuestionImage } from "@/lib/storage";
import { requireCourseAccess } from "@/lib/auth-helpers";
import { quizSchema, questionSchema } from "@/lib/validations/course";

export type QuizFormState = {
  error: string | null;
  success?: boolean;
};

async function quizCourseId(quizId: string) {
  const quiz = await prisma.quiz.findUniqueOrThrow({ where: { id: quizId }, select: { courseId: true } });
  return quiz.courseId;
}

async function questionQuizInfo(questionId: string) {
  const question = await prisma.question.findUniqueOrThrow({
    where: { id: questionId },
    select: { quizId: true, quiz: { select: { courseId: true } } },
  });
  return { quizId: question.quizId, courseId: question.quiz.courseId };
}

function revalidateCourse(courseId: string) {
  revalidatePath(`/admin/cursos/${courseId}`);
  revalidatePath(`/tutor/cursos/${courseId}`);
}

function parseQuizForm(formData: FormData) {
  return quizSchema.safeParse({
    moduleId: formData.get("moduleId") ?? "",
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    passingScore: formData.get("passingScore"),
    maxAttempts: formData.get("maxAttempts"),
    timeLimitMinutes: formData.get("timeLimitMinutes") || undefined,
    randomizeQuestions: formData.get("randomizeQuestions") === "on" || formData.get("randomizeQuestions") === "true",
    randomizeAnswers: formData.get("randomizeAnswers") === "on" || formData.get("randomizeAnswers") === "true",
    showResultsNow: formData.get("showResultsNow") === "on" || formData.get("showResultsNow") === "true",
  });
}

export async function createQuizAction(
  courseId: string,
  _prevState: QuizFormState,
  formData: FormData
): Promise<QuizFormState> {
  await requireCourseAccess(courseId);

  const parsed = parseQuizForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const data = parsed.data;

  if (data.moduleId) {
    const module_ = await prisma.courseModule.findUnique({ where: { id: data.moduleId }, select: { courseId: true } });
    if (!module_ || module_.courseId !== courseId) {
      return { error: "El módulo seleccionado no pertenece a este curso." };
    }
    // El aula solo muestra el primer cuestionario de cada módulo; un segundo
    // quedaría oculto e imposible de aprobar, bloqueando el curso para siempre.
    const existingQuiz = await prisma.quiz.findFirst({ where: { moduleId: data.moduleId }, select: { id: true } });
    if (existingQuiz) {
      return { error: "Este módulo ya tiene un cuestionario. Solo se admite uno por módulo." };
    }
  }

  await prisma.quiz.create({
    data: {
      courseId,
      moduleId: data.moduleId || null,
      title: data.title,
      description: data.description || null,
      passingScore: data.passingScore,
      maxAttempts: data.maxAttempts,
      timeLimitMinutes: data.timeLimitMinutes ?? null,
      randomizeQuestions: data.randomizeQuestions,
      randomizeAnswers: data.randomizeAnswers,
      showResultsNow: data.showResultsNow,
    },
  });

  revalidateCourse(courseId);
  return { error: null, success: true };
}

export async function updateQuizAction(
  quizId: string,
  _prevState: QuizFormState,
  formData: FormData
): Promise<QuizFormState> {
  const courseId = await quizCourseId(quizId);
  await requireCourseAccess(courseId);

  const parsed = parseQuizForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const data = parsed.data;

  if (data.moduleId) {
    const module_ = await prisma.courseModule.findUnique({ where: { id: data.moduleId }, select: { courseId: true } });
    if (!module_ || module_.courseId !== courseId) {
      return { error: "El módulo seleccionado no pertenece a este curso." };
    }
    const existingQuiz = await prisma.quiz.findFirst({
      where: { moduleId: data.moduleId, id: { not: quizId } },
      select: { id: true },
    });
    if (existingQuiz) {
      return { error: "Este módulo ya tiene un cuestionario. Solo se admite uno por módulo." };
    }
  }

  await prisma.quiz.update({
    where: { id: quizId },
    data: {
      moduleId: data.moduleId || null,
      title: data.title,
      description: data.description || null,
      passingScore: data.passingScore,
      maxAttempts: data.maxAttempts,
      timeLimitMinutes: data.timeLimitMinutes ?? null,
      randomizeQuestions: data.randomizeQuestions,
      randomizeAnswers: data.randomizeAnswers,
      showResultsNow: data.showResultsNow,
    },
  });

  revalidateCourse(courseId);
  return { error: null, success: true };
}

export async function deleteQuizAction(quizId: string) {
  const courseId = await quizCourseId(quizId);
  await requireCourseAccess(courseId);

  await prisma.quiz.delete({ where: { id: quizId } });
  revalidateCourse(courseId);
}

function parseQuestionForm(formData: FormData) {
  const optionsRaw = formData.get("optionsJson");
  let options: unknown = [];
  try {
    options = JSON.parse(typeof optionsRaw === "string" ? optionsRaw : "[]");
  } catch {
    options = [];
  }

  return questionSchema.safeParse({
    type: formData.get("type"),
    statement: formData.get("statement"),
    score: formData.get("score"),
    explanation: formData.get("explanation") ?? "",
    options,
  });
}

/**
 * Resuelve la imagen del enunciado: si llega un archivo nuevo lo guarda y
 * devuelve su URL; si no, conserva la actual (campo oculto), y si viene vacía
 * la quita. Así el mismo formulario sirve para poner, cambiar o dejar igual.
 */
async function resolverImagenPregunta(formData: FormData, quizId: string): Promise<string | null> {
  const archivo = formData.get("image");
  if (archivo instanceof File && archivo.size > 0) {
    return saveQuestionImage(archivo, quizId);
  }
  const actual = formData.get("currentImageUrl");
  return typeof actual === "string" && actual.length > 0 ? actual : null;
}

function validateOptionsForType(type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE" | "OPEN_TEXT", options: { isCorrect: boolean }[]): string | null {
  if (type === "OPEN_TEXT") return null; // respuesta abierta: sin opciones
  const correctCount = options.filter((o) => o.isCorrect).length;
  if (correctCount === 0) return "Marca al menos una opción correcta.";
  if (type === "TRUE_FALSE") {
    if (options.length !== 2) return "Verdadero/Falso debe tener exactamente 2 opciones.";
    if (correctCount !== 1) return "Verdadero/Falso debe tener exactamente una opción correcta.";
  }
  if (type === "SINGLE_CHOICE" && correctCount !== 1) {
    return "Selección única debe tener exactamente una opción correcta.";
  }
  return null;
}

export async function createQuestionAction(
  quizId: string,
  _prevState: QuizFormState,
  formData: FormData
): Promise<QuizFormState> {
  const courseId = await quizCourseId(quizId);
  await requireCourseAccess(courseId);

  const parsed = parseQuestionForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const data = parsed.data;

  const optionsError = validateOptionsForType(data.type, data.options);
  if (optionsError) return { error: optionsError };

  const count = await prisma.question.count({ where: { quizId } });
  const imageUrl = await resolverImagenPregunta(formData, quizId);

  await prisma.question.create({
    data: {
      quizId,
      type: data.type,
      statement: data.statement,
      imageUrl,
      score: data.score,
      explanation: data.explanation || null,
      sortOrder: count,
      options: {
        create: data.options.map((o, index) => ({
          text: o.text,
          isCorrect: o.isCorrect,
          sortOrder: index,
        })),
      },
    },
  });

  revalidateCourse(courseId);
  return { error: null, success: true };
}

export async function updateQuestionAction(
  questionId: string,
  _prevState: QuizFormState,
  formData: FormData
): Promise<QuizFormState> {
  const { courseId, quizId } = await questionQuizInfo(questionId);
  await requireCourseAccess(courseId);

  const parsed = parseQuestionForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const data = parsed.data;

  const optionsError = validateOptionsForType(data.type, data.options);
  if (optionsError) return { error: optionsError };

  const imageUrl = await resolverImagenPregunta(formData, quizId);

  await prisma.$transaction([
    prisma.question.update({
      where: { id: questionId },
      data: {
        type: data.type,
        statement: data.statement,
        imageUrl,
        score: data.score,
        explanation: data.explanation || null,
      },
    }),
    prisma.questionOption.deleteMany({ where: { questionId } }),
    prisma.question.update({
      where: { id: questionId },
      data: {
        options: {
          create: data.options.map((o, index) => ({
            text: o.text,
            isCorrect: o.isCorrect,
            sortOrder: index,
          })),
        },
      },
    }),
  ]);

  revalidateCourse(courseId);
  return { error: null, success: true };
}

export async function deleteQuestionAction(questionId: string) {
  const { courseId } = await questionQuizInfo(questionId);
  await requireCourseAccess(courseId);

  await prisma.question.delete({ where: { id: questionId } });
  revalidateCourse(courseId);
}

export async function reorderQuestionsAction(quizId: string, orderedQuestionIds: string[]) {
  const courseId = await quizCourseId(quizId);
  await requireCourseAccess(courseId);

  // Un tutor autorizado en su propio curso no debe poder colar el id de una
  // pregunta ajena para alterar su orden: se exige que todas pertenezcan a este quiz.
  const validCount = await prisma.question.count({ where: { id: { in: orderedQuestionIds }, quizId } });
  if (validCount !== orderedQuestionIds.length) {
    throw new Error("Una o más preguntas no pertenecen a este cuestionario.");
  }

  await prisma.$transaction([
    ...orderedQuestionIds.map((id, index) =>
      prisma.question.update({ where: { id }, data: { sortOrder: -(index + 1) } })
    ),
    ...orderedQuestionIds.map((id, index) => prisma.question.update({ where: { id }, data: { sortOrder: index } })),
  ]);

  revalidateCourse(courseId);
}
