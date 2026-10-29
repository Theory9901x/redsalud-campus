import { NextResponse } from "next/server";
import { getContenidoReunion } from "@/lib/reunion-contenido";

export async function GET(_request: Request, { params }: { params: Promise<{ activityId: string }> }) {
  const { activityId } = await params;
  const data = await getContenidoReunion(activityId);
  return data ? NextResponse.json(data, { headers: { "Cache-Control": "no-store" } }) : NextResponse.json({ error: "No autorizado." }, { status: 403 });
}
