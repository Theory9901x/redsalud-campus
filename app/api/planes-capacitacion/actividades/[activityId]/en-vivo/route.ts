import { NextResponse } from "next/server";
import { requireTrainingActivityAccess } from "@/lib/auth-helpers";
import { getActivityLiveMetrics } from "@/lib/training-plans";

/**
 * Cifras de la jornada en curso, para que el panel del tutor las refresque
 * sin recargar la página (ni perder la videollamada embebida al lado).
 *
 * Va por sondeo desde el cliente: el proyecto no tiene websockets ni SSE, y
 * montar esa infraestructura para cuatro números que cambian cada varios
 * minutos sería desproporcionado. El permiso es el mismo de la ficha: el
 * administrador, o el tutor del área dueña.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ activityId: string }> }) {
  const { activityId } = await params;

  try {
    await requireTrainingActivityAccess(activityId);
  } catch {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const metricas = await getActivityLiveMetrics(activityId);
  if (!metricas) return NextResponse.json({ error: "Capacitación no encontrada." }, { status: 404 });

  return NextResponse.json(metricas, { headers: { "Cache-Control": "no-store" } });
}
