import ExcelJS from "exceljs";
import {
  getPersonasTrazabilidad,
  getTrazabilidadPlan,
  type AlcanceTrazabilidad,
  type FilaPersona,
} from "@/lib/trazabilidad-llamadas";

/**
 * EXCEL de la trazabilidad de conexiones a la sala de un plan: lo que se
 * entrega o se anexa a un informe (nadie usa CSV). Mismo alcance y mismos
 * filtros que la página: ?t= (trimestre), ?area=, ?actividad=, ?q=.
 *
 *   1. Por área          · una fila por área con sus totales.
 *   2. Por capacitación  · una fila por capacitación, con audiencia objetivo,
 *                          % de la audiencia conectada y minutos por trimestre.
 *   3. Por persona       · una fila por persona y capacitación (TODAS, no
 *                          solo la página visible), con primera y última
 *                          conexión en hora de Colombia.
 *   4. Información       · plan, periodo, filtros, generado por y fecha.
 *
 * Estilo de la casa (ver lib/encuestas/exportar-siho.ts): encabezado navy
 * con texto blanco en negrilla, fila de encabezado fija, anchos por columna,
 * cebra suave y autofiltro.
 */

const NAVY = "FF0F2438";
const BLANCO = "FFFFFFFF";
const ZEBRA = "FFF4F7FA";
const GRIS = "FF6B7C8F";
const LINEA = "FFDCE3EA";

/** Tope de seguridad del detalle nominal (filas por persona × capacitación). */
const MAX_PERSONAS = 20_000;
const LOTE = 500;

const relleno = (argb: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb } });

/** ExcelJS escribe las fechas en UTC: se corren a hora de Colombia (UTC-5 fijo) para que la celda se lea local. */
const horaColombia = (d: Date | string) => new Date(new Date(d).getTime() - 5 * 3600e3);

type Columna = { titulo: string; ancho: number; formato?: string };

function hojaTabla(wb: ExcelJS.Workbook, nombre: string, columnas: Columna[], filas: (string | number | Date | null)[][]) {
  const hoja = wb.addWorksheet(nombre, { views: [{ state: "frozen", ySplit: 1 }] });
  hoja.columns = columnas.map((c) => ({ header: c.titulo, width: c.ancho, style: c.formato ? { numFmt: c.formato } : {} }));
  const cab = hoja.getRow(1);
  cab.height = 34;
  cab.eachCell((c) => {
    c.font = { bold: true, size: 10, color: { argb: BLANCO } };
    c.fill = relleno(NAVY);
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });
  for (const f of filas) hoja.addRow(f.map((v) => (v === null ? "" : v)));
  for (let r = 2; r <= hoja.rowCount; r++) {
    const fila = hoja.getRow(r);
    fila.font = { size: 10 };
    fila.alignment = { vertical: "middle" };
    fila.eachCell({ includeEmpty: true }, (c) => {
      if (r % 2 === 0) c.fill = relleno(ZEBRA);
      c.border = { bottom: { style: "hair", color: { argb: LINEA } } };
    });
  }
  if (hoja.rowCount > 1) hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: hoja.rowCount, column: columnas.length } };
  hoja.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
  hoja.headerFooter.oddFooter = `&L&8RedSalud Te Forma · Conexiones a la sala · ${nombre}&R&8Página &P de &N`;
  return hoja;
}

export async function generarExcelConexiones(
  alcance: AlcanceTrazabilidad,
  filtros: { trimestre: number | null; area: string | null; actividad: string | null; q: string | null }
): Promise<{ buffer: Buffer; nombre: string }> {
  const { trimestre, area, actividad, q } = filtros;
  const datos = await getTrazabilidadPlan(alcance, trimestre);

  // Detalle nominal COMPLETO: se recorre por lotes en vez de cortar en la
  // primera página (el CSV viejo se quedaba en 500 filas).
  const personas: FilaPersona[] = [];
  let total = 0;
  for (let pagina = 1; personas.length < MAX_PERSONAS; pagina++) {
    const lote = await getPersonasTrazabilidad(alcance, { trimestre, areaId: area, activityId: actividad, buscar: q, pagina, porPagina: LOTE });
    total = lote.total;
    personas.push(...lote.filas);
    if (lote.filas.length < LOTE || personas.length >= total) break;
  }

  const periodo = trimestre ? `T${trimestre} ${datos.anio}` : `Año ${datos.anio} completo`;
  const areas = datos.areas.filter((a) => !area || a.id === area);
  const capacitaciones = areas.flatMap((a) => a.capacitaciones.filter((c) => !actividad || c.id === actividad).map((c) => ({ area: a, c })));
  const nombreArea = area ? datos.areas.find((a) => a.id === area)?.nombre ?? "Área sin conexiones en el periodo" : "Todas";
  const nombreActividad = actividad
    ? datos.areas.flatMap((a) => a.capacitaciones).find((c) => c.id === actividad)?.titulo ?? "Capacitación sin conexiones en el periodo"
    : "Todas";

  const wb = new ExcelJS.Workbook();
  wb.creator = "RedSalud Te Forma";
  wb.created = new Date();
  wb.title = `Conexiones a la sala · ${alcance.plan.title}`;

  // ── 1. Por área ──
  hojaTabla(
    wb,
    "Por área",
    [
      { titulo: "Área", ancho: 34 },
      { titulo: "Periodo", ancho: 16 },
      { titulo: "Capacitaciones en vivo", ancho: 14, formato: "0" },
      { titulo: "Jornadas agendadas", ancho: 12, formato: "0" },
      { titulo: "Personas distintas", ancho: 12, formato: "#,##0" },
      { titulo: "Personas con cuenta", ancho: 12, formato: "#,##0" },
      { titulo: "Personas externas", ancho: 12, formato: "#,##0" },
      { titulo: "Conexiones (tramos)", ancho: 13, formato: "#,##0" },
      { titulo: "Minutos totales", ancho: 12, formato: "#,##0" },
      { titulo: "Permanencia promedio (min)", ancho: 14, formato: "#,##0" },
      { titulo: "Permanencia mediana (min)", ancho: 14, formato: "#,##0" },
    ],
    areas
      .map((a) => ({ a, caps: a.capacitaciones.filter((c) => !actividad || c.id === actividad) }))
      .filter(({ caps }) => caps.length > 0)
      .map(({ a, caps }) => [
        a.nombre,
        periodo,
        caps.length,
        caps.reduce((s, c) => s + c.jornadas, 0),
        a.kpis.personas,
        a.kpis.personasInternas,
        a.kpis.externos,
        a.kpis.tramos,
        a.kpis.minutos,
        a.kpis.permanenciaPromedioMin,
        a.kpis.permanenciaMedianaMin,
      ])
  );

  // ── 2. Por capacitación ──
  hojaTabla(
    wb,
    "Por capacitación",
    [
      { titulo: "Área", ancho: 28 },
      { titulo: "Capacitación", ancho: 50 },
      { titulo: "Trimestres programados", ancho: 13 },
      { titulo: "Periodo", ancho: 16 },
      { titulo: "Jornadas agendadas", ancho: 12, formato: "0" },
      { titulo: "Personas distintas", ancho: 12, formato: "#,##0" },
      { titulo: "Personas con cuenta", ancho: 12, formato: "#,##0" },
      { titulo: "Personas externas", ancho: 12, formato: "#,##0" },
      { titulo: "Conexiones (tramos)", ancho: 13, formato: "#,##0" },
      { titulo: "Minutos totales", ancho: 12, formato: "#,##0" },
      { titulo: "Permanencia promedio (min)", ancho: 14, formato: "#,##0" },
      { titulo: "Permanencia mediana (min)", ancho: 14, formato: "#,##0" },
      { titulo: "Audiencia objetivo", ancho: 12, formato: "#,##0" },
      { titulo: "% audiencia conectada", ancho: 13, formato: "0%" },
      { titulo: "Minutos T1", ancho: 10, formato: "#,##0" },
      { titulo: "Minutos T2", ancho: 10, formato: "#,##0" },
      { titulo: "Minutos T3", ancho: 10, formato: "#,##0" },
      { titulo: "Minutos T4", ancho: 10, formato: "#,##0" },
    ],
    capacitaciones.map(({ area: a, c }) => {
      const minT = (t: number) => c.porTrimestre.find((x) => x.trimestre === t)?.minutos ?? 0;
      return [
        a.nombre,
        c.titulo,
        c.quarters.map((t) => `T${t}`).join(" "),
        periodo,
        c.jornadas,
        c.kpis.personas,
        c.kpis.personasInternas,
        c.kpis.externos,
        c.kpis.tramos,
        c.kpis.minutos,
        c.kpis.permanenciaPromedioMin,
        c.kpis.permanenciaMedianaMin,
        c.audiencia,
        c.porcentajeConectados === null ? null : c.porcentajeConectados / 100,
        minT(1),
        minT(2),
        minT(3),
        minT(4),
      ];
    })
  );

  // ── 3. Por persona ──
  hojaTabla(
    wb,
    "Por persona",
    [
      { titulo: "Persona", ancho: 34 },
      { titulo: "Tipo de persona", ancho: 18 },
      { titulo: "Área", ancho: 28 },
      { titulo: "Capacitación", ancho: 46 },
      { titulo: "Periodo", ancho: 16 },
      { titulo: "Conexiones (tramos)", ancho: 13, formato: "#,##0" },
      { titulo: "Minutos en la sala", ancho: 12, formato: "#,##0" },
      { titulo: "Primera conexión", ancho: 18, formato: "dd/mm/yyyy hh:mm" },
      { titulo: "Última conexión", ancho: 18, formato: "dd/mm/yyyy hh:mm" },
    ],
    personas.map((p) => [
      p.nombre,
      p.externo ? "Externo" : "Personal con cuenta",
      p.area,
      p.capacitacion,
      periodo,
      p.conexiones,
      p.minutos,
      p.primeraConexion ? horaColombia(p.primeraConexion) : null,
      p.ultimaConexion ? horaColombia(p.ultimaConexion) : null,
    ])
  );

  // ── 4. Información ──
  const info = wb.addWorksheet("Información");
  info.columns = [{ width: 30 }, { width: 80 }];
  info.mergeCells(1, 1, 1, 2);
  const titulo = info.getCell(1, 1);
  titulo.value = "Conexiones a la sala · Trazabilidad";
  titulo.font = { bold: true, size: 14, color: { argb: BLANCO } };
  titulo.fill = relleno(NAVY);
  titulo.alignment = { vertical: "middle", indent: 1 };
  info.getRow(1).height = 28;
  const generado = new Date();
  const pares: [string, string | number | Date][] = [
    ["Plan", alcance.plan.title],
    ["Año del plan", alcance.plan.year],
    ["Periodo", periodo],
    ["Alcance", alcance.institucional ? "Institucional (todas las áreas)" : "Mis áreas a cargo"],
    ["Filtro · área", nombreArea],
    ["Filtro · capacitación", nombreActividad],
    ["Filtro · búsqueda por nombre", q || "Ninguna"],
    ["Personas conectadas (alcance)", datos.resumen.personas],
    ["Minutos en la sala (alcance)", datos.resumen.minutos],
    ["Filas en «Por persona»", personas.length < total ? `${personas.length} de ${total} (filtra por área o capacitación para el resto)` : personas.length],
    ["Generado por", alcance.usuario.nombre],
    ["Fecha de generación", horaColombia(generado)],
  ];
  pares.forEach(([k, v], i) => {
    const fila = info.getRow(i + 3);
    fila.getCell(1).value = k;
    fila.getCell(1).font = { bold: true, size: 10, color: { argb: NAVY } };
    fila.getCell(2).value = v;
    fila.getCell(2).font = { size: 10 };
    fila.getCell(2).alignment = { horizontal: "left", wrapText: true };
    if (v instanceof Date) fila.getCell(2).numFmt = "dd/mm/yyyy hh:mm";
    fila.eachCell({ includeEmpty: true }, (c) => {
      c.border = { bottom: { style: "hair", color: { argb: LINEA } } };
    });
  });
  const nota = info.getCell(pares.length + 4, 1);
  info.mergeCells(pares.length + 4, 1, pares.length + 4, 2);
  nota.value =
    "Cada tramo se registra solo cuando la persona sale de la sala de una capacitación en vivo; nadie lo marca a mano. La permanencia es por persona (suma de sus tramos). Horas en hora de Colombia.";
  nota.font = { italic: true, size: 9, color: { argb: GRIS } };
  nota.alignment = { wrapText: true };
  info.getRow(pares.length + 4).height = 30;

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  const base = alcance.plan.title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .toLowerCase()
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return { buffer, nombre: `conexiones-${base}-${trimestre ? `t${trimestre}` : "anual"}-${datos.anio}.xlsx` };
}
