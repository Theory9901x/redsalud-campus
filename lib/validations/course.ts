import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().trim().min(2, "El nombre es obligatorio."),
  description: z.string().trim().optional().or(z.literal("")),
});

export const courseSchema = z.object({
  title: z.string().trim().min(3, "El título es obligatorio."),
  slug: z
    .string()
    .trim()
    .min(3, "El slug es obligatorio.")
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "El slug solo puede tener minúsculas, números y guiones."),
  shortDescription: z.string().trim().min(10, "La descripción corta es obligatoria."),
  fullDescription: z.string().trim().optional().or(z.literal("")),
  instructions: z.string().trim().optional().or(z.literal("")),
  categoryId: z.string().trim().optional().or(z.literal("")),
  courseType: z.enum(["INDUCCION", "REINDUCCION", "CAPACITACION", "OBLIGATORIO", "COMPLEMENTARIO"]),
  durationHours: z.coerce.number().int().min(1, "La intensidad horaria debe ser mayor a 0."),
  passingScore: z.coerce.number().int().min(1).max(100),
  enrollmentMode: z.enum(["ASSIGNED", "OPEN"]),
  targetAudience: z.enum(["ADMINISTRATIVO", "ASISTENCIAL", "AMBOS"], {
    message: "Selecciona a qué personal va dirigido el curso.",
  }),
  isSequential: z.coerce.boolean(),
  tutorId: z.string().trim().optional().or(z.literal("")),
});

export const moduleSchema = z.object({
  title: z.string().trim().min(2, "El título del módulo es obligatorio."),
  description: z.string().trim().optional().or(z.literal("")),
  isRequired: z.coerce.boolean(),
});

export const lessonSchema = z.object({
  title: z.string().trim().min(2, "El título de la lección es obligatorio."),
  description: z.string().trim().optional().or(z.literal("")),
  contentType: z.enum(["TEXT", "YOUTUBE", "PDF", "IMAGE", "LINK", "MIXED"]),
  contentBody: z.string().trim().optional().or(z.literal("")),
  videoUrl: z.string().trim().optional().or(z.literal("")),
  externalUrl: z.string().trim().optional().or(z.literal("")),
  isRequired: z.coerce.boolean(),
  estimatedMinutes: z.coerce.number().int().min(0).optional(),
});

export const quizSchema = z.object({
  moduleId: z.string().trim().optional().or(z.literal("")),
  title: z.string().trim().min(3, "El título del cuestionario es obligatorio."),
  description: z.string().trim().optional().or(z.literal("")),
  passingScore: z.coerce.number().int().min(1).max(100),
  maxAttempts: z.coerce.number().int().min(1).max(10),
  timeLimitMinutes: z.coerce.number().int().min(1).optional(),
  randomizeQuestions: z.coerce.boolean(),
  randomizeAnswers: z.coerce.boolean(),
  showResultsNow: z.coerce.boolean(),
});

export const questionOptionSchema = z.object({
  text: z.string().trim().min(1, "El texto de la opción es obligatorio."),
  isCorrect: z.boolean(),
});

export const questionSchema = z.object({
  type: z.enum(["SINGLE_CHOICE", "MULTIPLE_CHOICE", "TRUE_FALSE"]),
  statement: z.string().trim().min(3, "El enunciado es obligatorio."),
  score: z.coerce.number().int().min(1).max(100),
  explanation: z.string().trim().optional().or(z.literal("")),
  options: z.array(questionOptionSchema).min(2, "Cada pregunta necesita al menos 2 opciones."),
});
