import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { toCsv, csvResponse } from "@/lib/csv";
import { getTrainingDashboardData } from "@/lib/training-dashboard";

export async function GET() {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "TUTOR")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { surveyRows } = await getTrainingDashboardData(session.user.role, session.user.id);

  const rows = surveyRows.map((s) => [s.title, s.scope, s.respondedCount, s.targetCount, `${s.responseRate}%`]);

  const csv = toCsv(["Encuesta", "Alcance", "Respondidas", "Objetivo", "Tasa de respuesta"], rows);
  return csvResponse("planes-encuestas.csv", csv);
}
