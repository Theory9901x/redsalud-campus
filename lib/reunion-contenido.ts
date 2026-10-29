import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getParticipanteDeCookie } from "@/app/invitado/[activityId]/actions";

/** Acceso de asistentes a los compromisos y adjuntos de su reunión. */
export async function puedeLeerContenidoReunion(activityId: string) {
  const session = await auth();
  const act = await prisma.trainingActivity.findFirst({ where: { id: activityId, plan: { kind: "REUNION" } }, select: { responsibleUserId: true, plan: { select: { createdById: true, tutorId: true } }, sessions: { take: 1, select: { audience: true } } } });
  if (!act) return false;
  if (session?.user) {
    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, role: true, status: true, canManageAllMeetings: true } });
    if (!user || user.status !== "ACTIVE") return false;
    if (user.role === "SEGUIMIENTO" || (user.role === "ADMIN" && user.canManageAllMeetings) || user.id === act.plan.createdById || user.id === (act.responsibleUserId ?? act.plan.tutorId)) return true;
    if (act.sessions[0]?.audience !== "EXTERNAL") return true;
  }
  if (act.sessions[0]?.audience === "INTERNAL") return false;
  return !!await getParticipanteDeCookie(activityId);
}

export async function getContenidoReunion(activityId: string) {
  if (!await puedeLeerContenidoReunion(activityId)) return null;
  const act = await prisma.trainingActivity.findUnique({ where: { id: activityId }, select: { followUpEvidence: true, documents: { orderBy: { createdAt: "desc" }, select: { id: true, fileName: true, fileUrl: true, description: true } } } });
  return act ? { compromisos: act.followUpEvidence, documentos: act.documents } : null;
}
export type ContenidoReunion = NonNullable<Awaited<ReturnType<typeof getContenidoReunion>>>;
