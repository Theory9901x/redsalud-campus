import { NextResponse } from "next/server";
import { requireTutorOrAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { getInformeSiau } from "@/lib/encuestas/metrics";
import { leerPeriodo } from "@/lib/encuestas/periodo-url";
import { renderInformeSiauPdf } from "@/lib/encuestas/informe-siau-pdf";
import { registrarExportacionSiau } from "@/lib/encuestas/registro-exportacion";
import { TEMAS_SUGERENCIAS } from "@/lib/encuestas/temas";

/** Informe general SIAU en PDF para un periodo (mensual, trimestral o anual) y filtros. */
export async function GET(request: Request) {
  let sesion;
  try {
    sesion = await requireTutorOrAdmin();
  } catch {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }
  const url = new URL(request.url);
  const periodo = leerPeriodo(url.searchParams);
  if (!periodo) return NextResponse.json({ error: "Periodo inválido." }, { status: 400 });
  const filtros = { sede: url.searchParams.get("sede") ?? undefined, servicio: url.searchParams.get("servicio") ?? undefined, sexo: url.searchParams.get("sexo") ?? undefined, eps: url.searchParams.get("eps") ?? undefined };
  const inf = await getInformeSiau(periodo, filtros);
  if (!inf) return NextResponse.json({ error: "No existe la encuesta SIAU." }, { status: 404 });
  const ajustes = await prisma.institutionSettings.findUnique({ where: { id: "singleton" }, select: { logoUrl: true } });
  const temas = TEMAS_SUGERENCIAS.map((t) => ({ tema: t.tema, n: inf.metricas.sugerencias.filter((s) => t.claves.test(s.texto)).length })).filter((t) => t.n > 0).sort((a, b) => b.n - a.n);
  const pdf = await renderInformeSiauPdf(inf, sesion.user.name ?? "—", ajustes?.logoUrl, temas);
  await registrarExportacionSiau(sesion.user.id, "informe-pdf", periodo, filtros);
  const hoy = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="SIAU_INFORME_${inf.rango.clave}_${hoy}.pdf"`, "Cache-Control": "no-store" },
  });
}
