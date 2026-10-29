import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getParticipanteDeCookie } from "@/app/invitado/[activityId]/actions";
import { prisma } from "@/lib/prisma";
import { reunionCerrada } from "@/lib/reuniones-policy";

export async function GET(_request: Request, { params }: { params: Promise<{ activityId: string }> }) {
  const { activityId } = await params;
  const session = await auth();
  if (!session?.user && !await getParticipanteDeCookie(activityId)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const act = await prisma.trainingActivity.findFirst({ where: { id: activityId, plan: { kind: "REUNION" } }, select: { status: true, sessions: { take: 1, select: { status: true, fase: true } } } });
  if (!act) return NextResponse.json({ error: "Reunión no encontrada." }, { status: 404 });
  return NextResponse.json({ cerrada: reunionCerrada(act.status, act.sessions[0]) }, { headers: { "Cache-Control": "no-store" } });
}
