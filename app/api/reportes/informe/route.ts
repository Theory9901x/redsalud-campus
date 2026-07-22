import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { renderInformePdf } from "@/lib/reporte-pdf";
import {
  certificadosPor,
  cumplimientoPor,
  kpis,
  metricasPlanta,
  type FiltrosReporte,
} from "@/lib/reportes";
import { PERSONNEL_TYPE_LABELS } from "@/lib/personnel-labels";

const VINCULACION_LABELS: Record<string, string> = {
  CARRERA_ADMINISTRATIVA: "Carrera administrativa",
  PROVISIONALIDAD: "Provisionalidad",
  TEMPORAL: "Temporal",
  TRABAJADOR_OFICIAL: "Trabajador oficial",
  LIBRE_NOMBRAMIENTO: "Libre nombramiento",
  PERIODO_FIJO: "Periodo fijo",
  CONTRATO_PRESTACION: "Contrato de prestación",
  OTRO: "Otro",
};

/**
 * Informe PDF del centro de datos. Recibe los mismos filtros de la pantalla y
 * RECOMPUTA las agregaciones en SQL: no confía en cifras enviadas por el
 * cliente, así que el informe siempre refleja el estado real de la base.
 */
export async function GET(request: Request) {
  const session = await requireAdmin();
  const sp = new URL(request.url).searchParams;

  const filtros: FiltrosReporte = {
    desde: sp.get("desde") ?? undefined,
    hasta: sp.get("hasta") ?? undefined,
    municipioId: sp.get("municipio") ?? undefined,
    grupo: sp.get("grupo") ?? undefined,
    cargoId: sp.get("cargo") ?? undefined,
    vinculacion: sp.get("vinculacion") ?? undefined,
    cursoId: sp.get("curso") ?? undefined,
  };

  // Nombres legibles de los filtros, para que el informe se explique solo.
  const [municipio, cargo, curso, ajustes] = await Promise.all([
    filtros.municipioId ? prisma.municipio.findUnique({ where: { id: filtros.municipioId }, select: { nombre: true } }) : null,
    filtros.cargoId ? prisma.cargo.findUnique({ where: { id: filtros.cargoId }, select: { nombre: true } }) : null,
    filtros.cursoId ? prisma.course.findUnique({ where: { id: filtros.cursoId }, select: { title: true } }) : null,
    prisma.institutionSettings.findUnique({ where: { id: "singleton" }, select: { logoUrl: true } }),
  ]);

  const descritos: string[] = [];
  if (municipio) descritos.push(`Municipio: ${municipio.nombre}`);
  if (filtros.grupo) descritos.push(`Grupo: ${PERSONNEL_TYPE_LABELS[filtros.grupo as "ASISTENCIAL"] ?? filtros.grupo}`);
  if (cargo) descritos.push(`Cargo: ${cargo.nombre}`);
  if (filtros.vinculacion) descritos.push(`Vinculación: ${VINCULACION_LABELS[filtros.vinculacion] ?? filtros.vinculacion}`);
  if (curso) descritos.push(`Curso: ${curso.title}`);
  if (filtros.desde) descritos.push(`Desde: ${filtros.desde}`);
  if (filtros.hasta) descritos.push(`Hasta: ${filtros.hasta}`);

  const [k, porMunicipio, porCargo, porGrupo, certMunicipio, planta] = await Promise.all([
    kpis(filtros),
    cumplimientoPor("municipio", filtros),
    cumplimientoPor("cargo", filtros),
    cumplimientoPor("grupo", filtros),
    certificadosPor("municipio", filtros),
    metricasPlanta(filtros),
  ]);

  const pdf = await renderInformePdf({
    generadoPor: session.user.name ?? "Administrador",
    filtrosDescritos: descritos,
    kpis: k,
    cumplimientoMunicipio: porMunicipio,
    cumplimientoCargo: porCargo,
    cumplimientoGrupo: porGrupo.map((g) => ({
      ...g,
      etiqueta: PERSONNEL_TYPE_LABELS[g.etiqueta as "ASISTENCIAL"] ?? g.etiqueta,
    })),
    certificadosMunicipio: certMunicipio,
    planta,
    logoUrl: ajustes?.logoUrl ?? null,
  });

  const fecha = new Date().toISOString().slice(0, 10);
  const sufijo = municipio ? `-${municipio.nombre.toLowerCase().replace(/\s+/g, "-")}` : "";
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="informe-centro-datos-${fecha}${sufijo}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
