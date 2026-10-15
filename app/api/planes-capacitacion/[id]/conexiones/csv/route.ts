import { NextResponse } from "next/server";
import { getPersonasTrazabilidad, getTrazabilidadPlan, parseTrimestre, resolverAlcanceTrazabilidad } from "@/lib/trazabilidad-llamadas";

/**
 * EXPORT CSV de la trazabilidad de conexiones: filas de ÁREA, de CAPACITACIÓN
 * y de PERSONA en un solo archivo (columna "Nivel"), con las mismas columnas.
 * Mismo alcance que la página (requireTutorOrAdmin + áreas del tutor) y los
 * mismos filtros: ?t= (trimestre), ?area=, ?actividad=, ?q= (nombre).
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

  const trimestre = parseTrimestre(sp.get("t"));
  const area = sp.get("area") || null;
  const actividad = sp.get("actividad") || null;
  const q = sp.get("q")?.trim() || null;

  const [datos, personas] = await Promise.all([
    getTrazabilidadPlan(alcance, trimestre),
    getPersonasTrazabilidad(alcance, { trimestre, areaId: area, activityId: actividad, buscar: q, pagina: 1, porPagina: 500 }),
  ]);

  const fecha = (d: Date | string | null) => (d ? new Date(d).toISOString() : "");
  const n = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));
  const periodo = trimestre ? `T${trimestre} ${datos.anio}` : `Año ${datos.anio}`;

  const cabecera = [
    "Nivel",
    "Área",
    "Capacitación",
    "Trimestres programados",
    "Periodo",
    "Persona",
    "Tipo de persona",
    "Jornadas agendadas",
    "Personas distintas",
    "Personas con cuenta",
    "Personas externas",
    "Conexiones (tramos)",
    "Minutos totales",
    "Permanencia promedio (min)",
    "Permanencia mediana (min)",
    "Audiencia objetivo",
    "% audiencia conectada",
    "Primera conexión",
    "Última conexión",
  ];

  const filas: string[][] = [cabecera];
  const areas = datos.areas.filter((a) => !area || a.id === area);
  for (const a of areas) {
    const capacitaciones = a.capacitaciones.filter((c) => !actividad || c.id === actividad);
    if (capacitaciones.length === 0) continue;
    if (!actividad) {
      filas.push([
        "Área", a.nombre, "", "", periodo, "", "", n(capacitaciones.reduce((s, c) => s + c.jornadas, 0)),
        n(a.kpis.personas), n(a.kpis.personasInternas), n(a.kpis.externos), n(a.kpis.tramos), n(a.kpis.minutos),
        n(a.kpis.permanenciaPromedioMin), n(a.kpis.permanenciaMedianaMin), "", "", "", "",
      ]);
    }
    for (const c of capacitaciones) {
      filas.push([
        "Capacitación", a.nombre, c.titulo, c.quarters.map((t) => `T${t}`).join(" "), periodo, "", "", n(c.jornadas),
        n(c.kpis.personas), n(c.kpis.personasInternas), n(c.kpis.externos), n(c.kpis.tramos), n(c.kpis.minutos),
        n(c.kpis.permanenciaPromedioMin), n(c.kpis.permanenciaMedianaMin), n(c.audiencia), n(c.porcentajeConectados), "", "",
      ]);
    }
  }
  for (const p of personas.filas) {
    filas.push([
      "Persona", p.area, p.capacitacion, "", periodo, p.nombre, p.externo ? "Externo" : "Personal con cuenta", "",
      "", "", "", n(p.conexiones), n(p.minutos), "", "", "", "", fecha(p.primeraConexion), fecha(p.ultimaConexion),
    ]);
  }
  if (personas.total > personas.filas.length) {
    filas.push(["Nota", `El detalle por persona se limita a ${personas.filas.length} de ${personas.total} registros; filtra por área o capacitación para exportar el resto.`]);
  }

  const celda = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const csv = "﻿" + filas.map((f) => f.map(celda).join(";")).join("\r\n");
  const nombre = `conexiones-${alcance.plan.title.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 40)}-${trimestre ? `t${trimestre}` : "anual"}-${datos.anio}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nombre}"`,
      "Cache-Control": "no-store",
    },
  });
}
