import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getTrainingDashboardData } from "@/lib/training-dashboard";
import { veComoAdmin } from "@/lib/roles";
import { hojaInformacion, hojaTabla, nuevoLibro, respuestaExcel } from "@/lib/excel-tabla";

/**
 * Excel de «Resultados de encuestas» del tablero. Mismos datos y permiso
 * que el CSV viejo (../route.ts), que sigue respondiendo sin enlace.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user || (!veComoAdmin(session.user.role) && session.user.role !== "TUTOR")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { surveyRows } = await getTrainingDashboardData(session.user.role, session.user.id);

  const wb = nuevoLibro();
  hojaTabla(
    wb,
    "Encuestas",
    [
      { titulo: "Encuesta", ancho: 48 },
      { titulo: "Alcance", ancho: 30 },
      { titulo: "Respondidas", ancho: 13 },
      { titulo: "Objetivo", ancho: 11 },
      { titulo: "Tasa de respuesta (%)", ancho: 20 },
    ],
    surveyRows.map((s) => [s.title, s.scope, s.respondedCount, s.targetCount, s.responseRate]),
    "RedSalud Te Forma · Resultados de encuestas"
  );
  hojaInformacion(wb, [["Contenido", "Resultados de encuestas"]]);

  return respuestaExcel(wb, "planes-encuestas.xlsx");
}
