import type { Prisma, Role } from "@prisma/client";

export function encuestaSoloDeArea(role: Role, tieneArea: boolean) {
  return role === "TUTOR" || (role === "ADMIN" && tieneArea);
}

export function capacitacionesParaEncuesta(userId: string, soloDeArea: boolean): Prisma.TrainingActivityWhereInput {
  return soloDeArea ? { plan: { kind: "CAPACITACION" }, area: { tutorId: userId, isActive: true } } : {};
}
