import { z } from "zod";

const fechaValida = (s: string) => {
  const d = new Date(`${s}T12:00:00-05:00`);
  return Number.isFinite(+d) && d.toISOString().slice(0, 10) === s;
};
export const edicionSesionReunion = z.object({
  reunion: z.string().trim().min(4, "Escribe el nombre de la reunión."),
  titulo: z.string().trim().min(4, "Escribe el nombre de la sesión."),
  objetivo: z.string().trim(), ordenDelDia: z.string().trim(), responsable: z.string().trim().min(2, "Escribe el responsable."), dirigidoA: z.string().trim(),
  anfitrionAreaId: z.string(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Selecciona una fecha válida.").refine(fechaValida, "La fecha no es válida."),
  inicio: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Selecciona la hora de inicio."),
  fin: z.union([z.literal(""), z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Selecciona una hora de fin válida.")]),
  audience: z.enum(["INTERNAL", "EXTERNAL", "BOTH"]), modalidad: z.enum(["VIRTUAL", "PRESENCIAL", "MIXTA"]), lugar: z.string().trim(),
}).refine(d => !d.fin || d.fin > d.inicio, { message: "La hora de fin debe ser posterior al inicio.", path: ["fin"] });
