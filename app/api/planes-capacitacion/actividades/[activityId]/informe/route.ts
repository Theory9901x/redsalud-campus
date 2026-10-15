import { NextResponse } from "next/server";
import { requireTrainingActivityAccess } from "@/lib/auth-helpers";
import { getActivityReportData, trimestresDeActividad } from "@/lib/training-plans";
import { prisma } from "@/lib/prisma";
import { renderActivityReportPdf } from "@/lib/activity-report-pdf";
import { getActivityEvidence } from "@/lib/activity-evidence";
import { getContextoInforme } from "@/lib/activity-report-contexto";
import { tituloLegible } from "@/components/training-plans/labels";

/**
 * PDF del informe de la jornada: se habilita SOLO cuando la capacitación está
 * CERRADA. Antes del cierre las cifras siguen moviéndose -gente presentando,
 * ventanas abiertas- y un informe a medias circularía como si fuera el final.
 *
 * Mismo permiso adscrito que la ficha: el admin, o el tutor del área dueña.
 */
export async function GET(request: Request, { params }: { params: Promise<{ activityId: string }> }) {
  const { activityId } = await params;
  const t = new URL(request.url).searchParams.get("t");

  let generatedBy: string;
  try {
    const { session } = await requireTrainingActivityAccess(activityId);
    generatedBy = session.user.name ?? "—";
  } catch {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  // ?t=N: informe de UN trimestre de la capacitación. Se habilita cuando ese
  // trimestre ya terminó (sus cifras no se mueven más) o con la jornada cerrada.
  let filtro = null;
  if (t) {
    const act = await prisma.trainingActivity.findUnique({ where: { id: activityId }, select: { id: true, quarters: true, plan: { select: { year: true } } } });
    if (!act) return NextResponse.json({ error: "La capacitación no existe." }, { status: 404 });
    filtro = (await trimestresDeActividad(act, t)).filtro;
  }
  const data = await getActivityReportData(activityId, filtro);
  if (!data) {
    return NextResponse.json({ error: "Esta capacitación no tiene contenido vinculado todavía." }, { status: 404 });
  }
  if (data.status !== "CLOSED" && !(filtro && filtro.hasta <= new Date())) {
    return NextResponse.json(
      { error: "El informe se habilita al cerrar la jornada: hasta entonces las cifras siguen cambiando." },
      { status: 409 }
    );
  }

  // Las evidencias se leen en vivo: la grabación se sube DESPUÉS de
  // cerrar la jornada, así que no puede venir del informe congelado.
  // El contexto (cobertura, permanencia por persona, jornadas, logo) también
  // es en vivo, por la misma razón.
  const [evidencia, contexto] = await Promise.all([getActivityEvidence(activityId), getContextoInforme(activityId, filtro)]);
  const pdf = await renderActivityReportPdf(data, generatedBy, evidencia, contexto);
  const nombre = tituloLegible(data.titulo).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Informe-${contexto?.codigo ?? "jornada"}-${nombre}.pdf"`,
    },
  });
}
