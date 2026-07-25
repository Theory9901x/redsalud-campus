import { z } from "zod";

const adminSectionSchema = z.enum([
  "USUARIOS",
  "CURSOS",
  "PLANES_CAPACITACION",
  "INSCRIPCIONES",
  "CERTIFICADOS",
  "NOTIFICACIONES",
  "REPORTES",
  "CONFIGURACION",
]);

// Correo y usuario: cada uno opcional por separado, pero hace falta AL MENOS
// UNO para poder iniciar sesión. El personal sin correo propio entra con un
// usuario tipo "nombre.apellido".
const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .email("Correo electrónico inválido.")
  .optional()
  .or(z.literal(""));

const usernameField = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]+$/, "El usuario solo puede tener letras, números, punto, guion y guion bajo (sin espacios).")
  .min(3, "El usuario debe tener al menos 3 caracteres.")
  .optional()
  .or(z.literal(""));

const requiereCredencial = (data: { email?: string; username?: string }, ctx: z.RefinementCtx) => {
  if (!data.email && !data.username) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Indica un correo o un usuario: la persona necesita al menos uno para iniciar sesión.",
      path: ["email"],
    });
  }
};

const baseUser = {
  fullName: z.string().trim().min(3, "El nombre completo es obligatorio."),
  documentType: z.enum(["CC", "CE", "TI", "PA"]),
  documentNumber: z.string().trim().min(4, "El número de documento es obligatorio."),
  email: emailField,
  username: usernameField,
  phone: z.string().trim().optional().or(z.literal("")),
  profession: z.string().trim().optional().or(z.literal("")),
  position: z.string().trim().optional().or(z.literal("")),
  department: z.string().trim().optional().or(z.literal("")),
  personnelType: z.enum(["ADMINISTRATIVO", "ASISTENCIAL"], {
    message: "Selecciona el tipo de personal.",
  }),
  role: z.enum(["ADMIN", "TUTOR", "STUDENT"]),
  restrictedAdminSections: z.array(adminSectionSchema).default([]),
};

export const createUserSchema = z
  .object({
    ...baseUser,
    password: z.string().min(8, "La contraseña temporal debe tener al menos 8 caracteres."),
  })
  .superRefine(requiereCredencial);

export const updateUserSchema = z
  .object({
    ...baseUser,
    status: z.enum(["ACTIVE", "INACTIVE", "BLOCKED"]),
  })
  .superRefine(requiereCredencial);
