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

export const createUserSchema = z.object({
  fullName: z.string().trim().min(3, "El nombre completo es obligatorio."),
  documentType: z.enum(["CC", "CE", "TI", "PA"]),
  documentNumber: z.string().trim().min(4, "El número de documento es obligatorio."),
  email: z.string().trim().email("Correo electrónico inválido."),
  phone: z.string().trim().optional().or(z.literal("")),
  profession: z.string().trim().optional().or(z.literal("")),
  position: z.string().trim().optional().or(z.literal("")),
  department: z.string().trim().optional().or(z.literal("")),
  personnelType: z.enum(["ADMINISTRATIVO", "ASISTENCIAL"], {
    message: "Selecciona el tipo de personal.",
  }),
  role: z.enum(["ADMIN", "TUTOR", "STUDENT"]),
  password: z.string().min(8, "La contraseña temporal debe tener al menos 8 caracteres."),
  restrictedAdminSections: z.array(adminSectionSchema).default([]),
});

export const updateUserSchema = z.object({
  fullName: z.string().trim().min(3, "El nombre completo es obligatorio."),
  documentType: z.enum(["CC", "CE", "TI", "PA"]),
  documentNumber: z.string().trim().min(4, "El número de documento es obligatorio."),
  email: z.string().trim().email("Correo electrónico inválido."),
  phone: z.string().trim().optional().or(z.literal("")),
  profession: z.string().trim().optional().or(z.literal("")),
  position: z.string().trim().optional().or(z.literal("")),
  department: z.string().trim().optional().or(z.literal("")),
  personnelType: z.enum(["ADMINISTRATIVO", "ASISTENCIAL"], {
    message: "Selecciona el tipo de personal.",
  }),
  role: z.enum(["ADMIN", "TUTOR", "STUDENT"]),
  status: z.enum(["ACTIVE", "INACTIVE", "BLOCKED"]),
  restrictedAdminSections: z.array(adminSectionSchema).default([]),
});
