import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getTrainingDashboardData } from "@/lib/training-dashboard";
import { TRAINING_PLAN_STATUS_LABELS } from "@/components/training-plans/labels";
import { veComoAdmin } from "@/lib/roles";
import { hojaInformacion, hojaTabla, nuevoLibro, respuestaExcel } from "@/lib/excel-tabla";

/**
 * Excel de «Planes y su cumplimiento» del tablero. Mismos datos y permiso
 * que el CSV viejo (../route.ts), que sigue respondiendo sin enlace.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user || (!veComoAdmin(session.user.role) && session.user.role !== "TUTOR")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { planRows } = await getTrainingDashboardData(session.user.role, session.user.id);

  const wb = nuevoLibro();
  hojaTabla(
    wb,
    "Planes",
    [
      { titulo: "Plan", ancho: 48 },
      { titulo: "Año", ancho: 8 },
      { titulo: "Dependencia", ancho: 30 },
      { titulo: "Estado", ancho: 14 },
      { titulo: "Capacitaciones", ancho: 15 },
      { titulo: "Cumplimiento (%)", ancho: 16 },
    ],
    planRows.map((p) => [
      p.title,
      p.year,
      p.targetDepartment ?? "Todo el personal",
      TRAINING_PLAN_STATUS_LABELS[p.status],
      p.activityCount,
      p.overallPercentage,
    ]),
    "RedSalud Te Forma · Planes y su cumplimiento"
  );
  hojaInformacion(wb, [
    ["Contenido", "Planes y su cumplimiento"],
    ["Cumplimiento", "Vacío = sin datos todavía"],
  ]);

  return respuestaExcel(wb, "planes-cumplimiento.xlsx");
}
