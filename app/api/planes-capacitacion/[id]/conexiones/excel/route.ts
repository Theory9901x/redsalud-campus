import { NextResponse } from "next/server";
import { parseTrimestre, resolverAlcanceTrazabilidad } from "@/lib/trazabilidad-llamadas";
import { generarExcelConexiones } from "@/lib/trazabilidad-excel";

/**
 * EXPORT EXCEL (.xlsx) de la trazabilidad de conexiones a la sala: hojas
 * «Por área», «Por capacitación», «Por persona» e «Información». Mismo
 * alcance que la página (requireTutorOrAdmin + áreas del tutor) y los
 * mismos filtros: ?t= (trimestre), ?area=, ?actividad=, ?q= (nombre).
 * Reemplaza al CSV (que sigue respondiendo solo para enlaces viejos).
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sp = new URL(request.url).searchParams;

  let alcance;
  try {
    alcance = await resolverAlcanceTrazabilidad(id);
  } catch {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }
  if (!alcance) return NextResponse.json({ error: "Plan no encontrado." }, { status: 404 });

  const { buffer, nombre } = await generarExcelConexiones(alcance, {
    trimestre: parseTrimestre(sp.get("t")),
    area: sp.get("area") || null,
    actividad: sp.get("actividad") || null,
    q: sp.get("q")?.trim() || null,
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombre}"`,
      "Cache-Control": "no-store",
    },
  });
}
