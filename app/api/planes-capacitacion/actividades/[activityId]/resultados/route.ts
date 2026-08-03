import { NextResponse } from "next/server";
import { requireTrainingActivityAccess } from "@/lib/auth-helpers";
import { getCycleResults } from "@/lib/training-plans";
import { toCsv, csvResponse } from "@/lib/csv";

/**
 * CSV de resultados por persona del ciclo presaber/postsaber.
 *
 * Mismo permiso adscrito que la pantalla de la que sale: el admin, o el
 * tutor del área dueña de la capacitación. Un CSV con nombres, documentos y
 * notas es un dato de personas; no viaja a quien no responde por él.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ activityId: string }> }) {
  const { activityId } = await params;

  try {
    await requireTrainingActivityAccess(activityId);
  } catch {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const resultados = await getCycleResults(activityId);
  if (!resultados) {
    return NextResponse.json({ error: "Esta capacitación no tiene resultados todavía." }, { status: 404 });
  }

  const csv = toCsv(
    ["Nombre", "Documento", "Presaber (%)", "Postsaber (%)", "Diferencia (pp)"],
    resultados.personas.map((p) => [p.fullName, p.documentNumber, p.presaber, p.postsaber, p.diferencia])
  );

  return csvResponse("resultados-presaber-postsaber.csv", csv);
}
