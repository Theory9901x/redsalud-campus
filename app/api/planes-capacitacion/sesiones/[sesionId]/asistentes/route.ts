import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTrainingActivityAccess } from "@/lib/auth-helpers";
import { getAsistentesSesion } from "@/lib/sesiones-presenciales";

// Regla del módulo: las fechas se formatean donde se renderiza primero.
// El panel es cliente, así que la hora viaja YA formateada desde aquí.
const FORMATO_HORA = new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit", second: "2-digit" });

/**
 * FASE 10 — Asistentes de la sesión EN VIVO, para el contador del tutor.
 * Sondeo ligero (el panel consulta cada 10 s); mismo permiso adscrito que
 * la ficha de la actividad.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ sesionId: string }> }) {
  const { sesionId } = await params;

  const sesion = await prisma.trainingSession.findUnique({
    where: { id: sesionId },
    select: { activityId: true, fase: true },
  });
  if (!sesion) return NextResponse.json({ error: "Sesión no encontrada." }, { status: 404 });

  try {
    await requireTrainingActivityAccess(sesion.activityId);
  } catch {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const asistentes = await getAsistentesSesion(sesionId);
  return NextResponse.json(
    {
      fase: sesion.fase,
      total: asistentes.length,
      asistentes: asistentes.map((a) => ({
        nombre: a.user.fullName,
        documento: a.user.documentNumber,
        hora: FORMATO_HORA.format(a.registradaEn),
        medio: a.medio,
      })),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
