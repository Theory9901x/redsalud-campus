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

/** La delegación permite gestionar una sesión concreta; el listado sigue siendo del creador. */
export function alcanceSesionReunion(user: UsuarioReuniones): Prisma.TrainingActivityWhereInput {
  if (user.role === "SEGUIMIENTO" || (user.role === "ADMIN" && user.canManageAllMeetings)) return { plan: { kind: "REUNION" } };
  return { plan: { kind: "REUNION" }, OR: [
    { plan: { createdById: user.id } },
    { responsibleUserId: user.id },
    { responsibleUserId: null, plan: { tutorId: user.id } },
  ] };
}

/** El horario no cierra una reunión: únicamente lo hace el cierre manual. */
export function reunionCerrada(estado: string, jornada?: { status: string; fase: string } | null) {
  return estado === "CLOSED" || jornada?.status === "CLOSED" || jornada?.fase === "CERRADA";
}
