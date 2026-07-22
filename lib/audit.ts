import { prisma } from "@/lib/prisma";

/**
 * Bitácora de auditoría: deja rastro de cada cambio hecho en la plataforma
 * para poder responder "quién hizo qué y cuándo".
 *
 * Nunca lanza: si el registro de auditoría falla, la operación de negocio que
 * lo invocó ya ocurrió y no debe deshacerse ni romperse por no haber podido
 * anotarla. El fallo se reporta por consola para que quede visible en los logs.
 */
export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "LOGIN"
  | "ENROLL"
  | "UNENROLL"
  | "PUBLISH"
  | "ISSUE_CERT"
  | "REVOKE_CERT"
  | "RESTORE_CERT"
  | "RESET_PASSWORD"
  | "IMPORT";

export type AuditEntity =
  | "User"
  | "Course"
  | "Module"
  | "Lesson"
  | "Enrollment"
  | "Certificate"
  | "TrainingPlan"
  | "Notification"
  | "Settings";

export async function registrarAuditoria(params: {
  userId?: string | null;
  action: AuditAction;
  entity: AuditEntity;
  entityId?: string | null;
  description?: string;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId ?? null,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId ?? null,
        description: params.description ?? null,
      },
    });
  } catch (error) {
    console.error("No se pudo registrar en la bitácora:", error);
  }
}
