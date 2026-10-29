import type { Prisma, Role } from "@prisma/client";

export type UsuarioReuniones = { id: string; role: Role; canManageAllMeetings: boolean };

export function alcanceReuniones(user: UsuarioReuniones): Prisma.TrainingPlanWhereInput {
  return user.role === "SEGUIMIENTO" || (user.role === "ADMIN" && user.canManageAllMeetings)
    ? { kind: "REUNION" }
    : { kind: "REUNION", createdById: user.id };
}

export function puedeEscribirReuniones(user: UsuarioReuniones) {
  return user.role === "ADMIN" || user.role === "TUTOR";
}
