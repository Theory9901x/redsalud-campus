import { NextResponse } from "next/server";
import { getGestionReunion } from "@/lib/reuniones-gestion";

export async function GET(_request: Request, { params }: { params: Promise<{ planId: string; activityId: string }> }) {
  const { planId, activityId } = await params;
  try {
    const d = await getGestionReunion(planId, activityId);
    return d ? NextResponse.json(d, { headers: { "Cache-Control": "no-store" } }) : NextResponse.json({ error: "Sesión no encontrada." }, { status: 404 });
  } catch { return NextResponse.json({ error: "No autorizado." }, { status: 403 }); }
}
