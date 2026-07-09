import { z } from "zod";

export const createNotificationSchema = z
  .object({
    title: z.string().trim().min(3, "El título es obligatorio."),
    body: z.string().trim().min(3, "El contenido es obligatorio."),
    severity: z.enum(["INFO", "SUCCESS", "WARNING", "DANGER"]),
    targetType: z.enum(["ALL", "ROLE", "USER"]),
    targetRole: z.enum(["ADMIN", "TUTOR", "STUDENT"]).optional().or(z.literal("")),
    targetUserId: z.string().trim().optional().or(z.literal("")),
  })
  .refine((data) => data.targetType !== "ROLE" || !!data.targetRole, {
    message: "Selecciona el rol destinatario.",
    path: ["targetRole"],
  })
  .refine((data) => data.targetType !== "USER" || !!data.targetUserId, {
    message: "Selecciona el usuario destinatario.",
    path: ["targetUserId"],
  });
