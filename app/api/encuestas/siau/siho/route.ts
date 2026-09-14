import { NextResponse } from "next/server";
import { requireTutorOrAdmin } from "@/lib/auth-helpers";
import { generarInformeSiho } from "@/lib/encuestas/exportar-siho";
import { leerPeriodo } from "@/lib/encuestas/periodo-url";

/**
 * Informe SIHO (ente de control) en Excel, por periodo:
 *   ?tipo=mensual&anio=2026&mes=9 · ?tipo=trimestral&anio=2026&trimestre=3 · ?tipo=anual&anio=2026
 */
export async function GET(request: Request) {
  try {
    await requireTutorOrAdmin();
  } catch {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }
  const url = new URL(request.url);
  const periodo = leerPeriodo(url.searchParams);
  if (!periodo) return NextResponse.json({ error: "Periodo inválido." }, { status: 400 });
  const sede = url.searchParams.get("sede") ?? undefined;
  const r = await generarInformeSiho(periodo, { sede });
  if (!r) return NextResponse.json({ error: "No existe la encuesta SIAU." }, { status: 404 });
  return new NextResponse(new Uint8Array(r.buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${r.nombre}"`,
      "Cache-Control": "no-store",
    },
  });
}
