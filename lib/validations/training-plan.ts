import { z } from "zod";

export const trainingPlanSchema = z.object({
  title: z.string().trim().min(3, "El título es obligatorio."),
  year: z.coerce.number().int().min(2000).max(2100),
  description: z.string().trim().optional().or(z.literal("")),
  // Vacío = dirigido a todo el personal, sin importar el área/proceso.
  targetDepartment: z.string().trim().optional().or(z.literal("")),
  tutorId: z.string().trim().optional().or(z.literal("")),
});

// El curso vinculado es siempre opcional, incluso en actividades tipo
// COURSE: no toda actividad de tipo "curso" corresponde a un curso ya creado
// en la plataforma -puede gestionarse directamente en el plan (asistencia,
// documentos) sin depender de que exista ese registro-. "No aplica" es una
// elección explícita, no solo la ausencia de selección.
export const trainingActivitySchema = z.object({
  title: z.string().trim().min(3, "El título es obligatorio."),
  type: z.enum(["COURSE", "EXTERNAL_EVENT"]),
  courseId: z.string().trim().optional().or(z.literal("")),
  startDate: z.string().trim().min(1, "La fecha de inicio es obligatoria."),
  endDate: z.string().trim().optional().or(z.literal("")),
  targetAudience: z.enum(["ADMINISTRATIVO", "ASISTENCIAL", "AMBOS"], {
    message: "Selecciona a qué personal va dirigida la actividad.",
  }),
  isRequired: z.coerce.boolean(),
});

/**
 * Jornada concreta de una capacitación: el día en que de verdad se dicta.
 *
 * Es un dato distinto del trimestre que trae el plan -ahí solo se sabe el
 * periodo, aquí se sabe la fecha y la hora- y por eso valida aparte: nada
 * de lo que exige esta jornada (hora fin posterior a la de inicio, cupo
 * positivo) tiene sentido para la línea del plan en sí.
 */
export const trainingSessionSchema = z
  .object({
    startsAtDate: z.string().trim().min(1, "La fecha es obligatoria."),
    startsAtTime: z.string().trim().min(1, "La hora de inicio es obligatoria."),
    endsAtTime: z.string().trim().optional().or(z.literal("")),
    shift: z.enum(["MANANA", "TARDE"]).optional().or(z.literal("")),
    modality: z.enum(["VIRTUAL", "PRESENCIAL", "MIXTA"]),
    location: z.string().trim().optional().or(z.literal("")),
    meetingUrl: z.string().trim().optional().or(z.literal("")),
    capacity: z.coerce.number().int().positive().optional().or(z.literal("")),
    municipioId: z.string().trim().optional().or(z.literal("")),
  })
  .refine((data) => !data.endsAtTime || data.endsAtTime > data.startsAtTime, {
    message: "La hora de fin debe ser posterior a la de inicio.",
    path: ["endsAtTime"],
  });
