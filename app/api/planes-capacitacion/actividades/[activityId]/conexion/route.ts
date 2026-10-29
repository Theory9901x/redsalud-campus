import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getParticipanteDeCookie } from "@/app/invitado/[activityId]/actions";
import { registrarIngresoLlamada, registrarConexionLlamada } from "@/lib/call-connections";

/** Recibe ingreso, permanencia y salida de la llamada.
 * La identidad procede de la sesión autenticada o de la cookie del invitado.
 */
export async function POST(request: Request, { params }: { params: Promise<{ activityId: string }> }) {
  const { activityId } = await params;

  let body: { event?: string; joinedAt?: string; leftAt?: string; displayName?: string; externalParticipantId?: string; sessionId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!body.joinedAt || (body.event !== "JOIN" && !body.leftAt) || !body.displayName) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const session = await auth();
  const userId = session?.user?.id ?? null;
  const invitado = userId ? null : await getParticipanteDeCookie(activityId);
  if (!userId && !invitado) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    if (body.event === "JOIN") {
      await registrarIngresoLlamada({ activityId, userId, externalParticipantId: invitado?.id ?? null, displayName: session?.user?.name ?? invitado?.fullName ?? body.displayName, joinedAt: new Date(body.joinedAt), sessionId: typeof body.sessionId === "string" ? body.sessionId : invitado?.sessionId ?? null });
      return NextResponse.json({ ok: true });
    }
    await registrarConexionLlamada({
      event: body.event === "HEARTBEAT" ? "HEARTBEAT" : "LEAVE",
      activityId,
      userId,
      externalParticipantId: invitado?.id ?? null,
      displayName: body.displayName,
      joinedAt: new Date(body.joinedAt),
      leftAt: new Date(body.leftAt!),
      sessionId: typeof body.sessionId === "string" ? body.sessionId : null,
    });
  } catch (error) {
    console.error("No se pudo registrar un tramo de conexión a la videollamada", error);
  }

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
