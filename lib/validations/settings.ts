import { z } from "zod";

export const institutionSettingsSchema = z.object({
  institutionName: z.string().trim().min(2, "El nombre de la institución es obligatorio."),
  contactEmail: z.string().trim().email("Correo inválido.").optional().or(z.literal("")),
  contactPhone: z.string().trim().optional().or(z.literal("")),
  city: z.string().trim().min(2, "La ciudad es obligatoria."),
  certificateText: z.string().trim().optional().or(z.literal("")),
  signerName: z.string().trim().optional().or(z.literal("")),
  signerPosition: z.string().trim().optional().or(z.literal("")),
});
