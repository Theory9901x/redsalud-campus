import { z } from "zod";

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(3, "El nombre completo es obligatorio."),
    documentType: z.enum(["CC", "CE", "TI", "PA"]),
    documentNumber: z.string().trim().min(4, "El número de documento es obligatorio."),
    email: z.string().trim().email("Correo electrónico inválido."),
    phone: z.string().trim().optional().or(z.literal("")),
    profession: z.string().trim().optional().or(z.literal("")),
    password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden.",
    path: ["confirmPassword"],
  });
