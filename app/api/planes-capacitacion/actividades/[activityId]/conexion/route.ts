import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { registrarConexionLlamada } from "@/lib/call-connections";

/**
 * Recibe UN tramo de conexión a la videollamada, enviado por
 * `navigator.sendBeacon` justo cuando la persona sale de la sala (o cierra
 * la pestaña). Nunca se sondea ni se llama mientras la llamada sigue activa.
 *
 * Sin autorización de rol: cualquiera que estuvo en la sala -personal,
 * tutor o invitado externo- puede reportar SU PROPIO tramo. La identidad
 * sale de la sesión si la hay; si no, del `externalParticipantId` que la
 * página del invitado ya conocía, validado contra esta misma actividad
 * dentro de `registrarConexionLlamada`.
 *
 * Es telemetría interna disparada por sendBeacon -nadie lee la respuesta ni
 * reintenta-: cualquier fallo se registra en el log del servidor y jamás se
 * deja ver, para no interferir con la salida de la sala de nadie.
 */
export async function POST(request: Request, { params }: { params: Promise<{ activityId: string }> }) {
  const { activityId } = await params;

  let body: { joinedAt?: string; leftAt?: string; displayName?: string; externalParticipantId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!body.joinedAt || !body.leftAt || !body.displayName) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const session = await auth();
  const userId = session?.user?.id ?? null;

  try {
    await registrarConexionLlamada({
      activityId,
      userId,
      externalParticipantId: userId ? null : (body.externalParticipantId ?? null),
      displayName: body.displayName,
      joinedAt: new Date(body.joinedAt),
      leftAt: new Date(body.leftAt),
    });
  } catch (error) {
    console.error("No se pudo registrar un tramo de conexión a la videollamada", error);
  }

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
