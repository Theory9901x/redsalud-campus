import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { toCsv, csvResponse } from "@/lib/csv";
import { getTrainingDashboardData } from "@/lib/training-dashboard";
import { TRAINING_PLAN_STATUS_LABELS } from "@/components/training-plans/labels";

export async function GET() {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "TUTOR")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { planRows } = await getTrainingDashboardData(session.user.role, session.user.id);

  const rows = planRows.map((p) => [
    p.title,
    p.year,
    p.targetDepartment ?? "Todo el personal",
    TRAINING_PLAN_STATUS_LABELS[p.status],
    p.activityCount,
    p.overallPercentage !== null ? `${p.overallPercentage}%` : "Sin datos",
  ]);

  const csv = toCsv(["Plan", "Año", "Dependencia", "Estado", "Actividades", "Cumplimiento"], rows);
  return csvResponse("planes-cumplimiento.csv", csv);
}
