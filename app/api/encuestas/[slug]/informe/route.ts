import { NextResponse } from "next/server";
import { requireSurveyAccess } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { getResultadosEncuesta } from "@/lib/encuestas/consultas";
import { renderInformeEncuestaPdf } from "@/lib/encuesta-report-pdf";

/**
 * PDF del informe de resultados de una encuesta: métricas, gráficas y la
 * tabulación completa por pregunta. Mismo permiso que el panel de
 * resultados; a diferencia del informe de jornada, se puede generar en
 * cualquier momento -una encuesta abierta también se monitorea- y el propio
 * documento deja constancia de la fecha de generación.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ref = await prisma.survey.findUnique({ where: { slug }, select: { id: true } });
  if (!ref) return NextResponse.json({ error: "Encuesta no encontrada." }, { status: 404 });
  const id = ref.id;

  let generatedBy: string;
  try {
    const { session } = await requireSurveyAccess(id);
    generatedBy = session.user.name ?? "—";
  } catch {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const datos = await getResultadosEncuesta(id);
  if (!datos) return NextResponse.json({ error: "Encuesta no encontrada." }, { status: 404 });

  const pdf = await renderInformeEncuestaPdf(datos, generatedBy);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="informe-${datos.encuesta.code}.pdf"`,
    },
  });
}
