import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getParticipanteDeCookie } from "@/app/invitado/[activityId]/actions";
import { prisma } from "@/lib/prisma";
import { reunionCerrada } from "@/lib/reuniones-policy";
import { cerrarReunionesVencidas } from "@/lib/en-vivo";

// Cada sala abierta consulta su estado cada 10 s: se aprovecha para cerrar
// las reuniones con más de 24 h desde su inicio, como mucho una vez cada 5
// minutos por proceso. El cierre nunca toca una sala con gente conectada
// en los últimos minutos (lib/en-vivo.ts).
let ultimoBarrido = 0;
function barrerVencidas() {
  const ahora = Date.now();
  if (ahora - ultimoBarrido < 5 * 60_000) return;
  ultimoBarrido = ahora;
  void cerrarReunionesVencidas().catch((e) => console.error("No se pudieron cerrar las reuniones vencidas", e));
}

export async function GET(_request: Request, { params }: { params: Promise<{ activityId: string }> }) {
  const { activityId } = await params;
  barrerVencidas();
  const session = await auth();
  if (!session?.user && !await getParticipanteDeCookie(activityId)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const act = await prisma.trainingActivity.findFirst({ where: { id: activityId, plan: { kind: "REUNION" } }, select: { status: true, sessions: { take: 1, select: { status: true, fase: true } } } });
  if (!act) return NextResponse.json({ error: "Reunión no encontrada." }, { status: 404 });
  return NextResponse.json({ cerrada: reunionCerrada(act.status, act.sessions[0]) }, { headers: { "Cache-Control": "no-store" } });
}
