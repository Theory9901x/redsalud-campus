import { NextResponse } from "next/server";
import { requireTrainingActivityAccess } from "@/lib/auth-helpers";
import { getActivityReportData } from "@/lib/training-plans";
import { renderActivityReportPdf } from "@/lib/activity-report-pdf";
import { getActivityEvidence } from "@/lib/activity-evidence";

/**
 * PDF del informe de la jornada: se habilita SOLO cuando la capacitación está
 * CERRADA. Antes del cierre las cifras siguen moviéndose -gente presentando,
 * ventanas abiertas- y un informe a medias circularía como si fuera el final.
 *
 * Mismo permiso adscrito que la ficha: el admin, o el tutor del área dueña.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ activityId: string }> }) {
  const { activityId } = await params;

  let generatedBy: string;
  try {
    const { session } = await requireTrainingActivityAccess(activityId);
    generatedBy = session.user.name ?? "—";
  } catch {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const data = await getActivityReportData(activityId);
  if (!data) {
    return NextResponse.json({ error: "Esta capacitación no tiene contenido vinculado todavía." }, { status: 404 });
  }
  if (data.status !== "CLOSED") {
    return NextResponse.json(
      { error: "El informe se habilita al cerrar la jornada: hasta entonces las cifras siguen cambiando." },
      { status: 409 }
    );
  }

  // Las evidencias se leen en vivo: la grabación se sube DESPUÉS de
  // cerrar la jornada, así que no puede venir del informe congelado.
  const evidencia = await getActivityEvidence(activityId);
  const pdf = await renderActivityReportPdf(data, generatedBy, evidencia);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="informe-jornada.pdf"`,
    },
  });
}
