import { prisma } from "@/lib/prisma";

/** Cuenta que entra a las salas a revisar: no deja rastro en asistencias, conexiones ni actas. */
export async function excluidoDeAsistencia(userId: string): Promise<boolean> {
  const usuario = await prisma.user.findUnique({ where: { id: userId }, select: { excludeFromAttendance: true } });
  return usuario?.excludeFromAttendance ?? false;
}
