import { z } from "zod";

export const surveySchema = z.object({
  title: z.string().trim().min(3, "El título es obligatorio."),
  description: z.string().trim().optional().or(z.literal("")),
  targetDepartment: z.string().trim().min(2, "El proceso/área objetivo es obligatorio."),
  targetAudience: z.enum(["ADMINISTRATIVO", "ASISTENCIAL", "AMBOS"], {
    message: "Selecciona a qué personal va dirigida la encuesta.",
  }),
});

export const surveyQuestionOptionSchema = z.object({
  text: z.string().trim().min(1, "El texto de la opción es obligatorio."),
});

export const surveyQuestionSchema = z
  .object({
    type: z.enum(["SINGLE_CHOICE", "MULTIPLE_CHOICE", "SCALE", "TEXT"]),
    statement: z.string().trim().min(3, "El enunciado es obligatorio."),
    isRequired: z.coerce.boolean(),
    scaleMin: z.coerce.number().int().optional(),
    scaleMax: z.coerce.number().int().optional(),
    options: z.array(surveyQuestionOptionSchema),
  })
  .refine(
    (data) => (data.type === "SINGLE_CHOICE" || data.type === "MULTIPLE_CHOICE" ? data.options.length >= 2 : true),
    { message: "Cada pregunta de selección necesita al menos 2 opciones.", path: ["options"] }
  )
  .refine((data) => (data.type === "SCALE" ? (data.scaleMin ?? 1) < (data.scaleMax ?? 5) : true), {
    message: "El máximo de la escala debe ser mayor que el mínimo.",
    path: ["scaleMax"],
  });
