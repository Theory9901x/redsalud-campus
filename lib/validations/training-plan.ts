import { z } from "zod";

export const trainingPlanSchema = z.object({
  title: z.string().trim().min(3, "El título es obligatorio."),
  year: z.coerce.number().int().min(2000).max(2100),
  description: z.string().trim().optional().or(z.literal("")),
  targetDepartment: z.string().trim().min(2, "El proceso/área objetivo es obligatorio."),
  tutorId: z.string().trim().optional().or(z.literal("")),
});

export const trainingActivitySchema = z
  .object({
    title: z.string().trim().min(3, "El título es obligatorio."),
    type: z.enum(["COURSE", "EXTERNAL_EVENT"]),
    courseId: z.string().trim().optional().or(z.literal("")),
    startDate: z.string().trim().min(1, "La fecha de inicio es obligatoria."),
    endDate: z.string().trim().optional().or(z.literal("")),
    targetAudience: z.enum(["ADMINISTRATIVO", "ASISTENCIAL", "AMBOS"], {
      message: "Selecciona a qué personal va dirigida la actividad.",
    }),
    isRequired: z.coerce.boolean(),
  })
  .refine((data) => data.type !== "COURSE" || !!data.courseId, {
    message: "Selecciona el curso vinculado.",
    path: ["courseId"],
  });
