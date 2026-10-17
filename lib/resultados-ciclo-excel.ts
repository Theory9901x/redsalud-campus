import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { getCycleResults, trimestresDeActividad } from "@/lib/training-plans";
import { getConteosPorJornada } from "@/lib/jornadas";

/**
 * EXCEL de los resultados presaber / postsaber de una capacitación: lo que
 * se anexa al informe. Mismo estilo de la casa que lib/trazabilidad-excel.ts
 * (encabezado navy, fila fija, anchos por columna, cebra y autofiltro).
 *
 *   1. Por persona   · mejor intento de cada momento y diferencia.
 *   2. Por pregunta  · % de acierto en presaber y en postsaber.
 *   3. Por jornada   · asistentes, presaber, postsaber e invitados de cada jornada.
 *   4. Información   · capacitación, plan, trimestre y fecha de generación.
 */

const NAVY = "FF0F2438";
const BLANCO = "FFFFFFFF";
const ZEBRA = "FFF4F7FA";
const LINEA = "FFDCE3EA";

const relleno = (argb: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const horaColombia = (d: Date) => new Date(d.getTime() - 5 * 3600e3);

type Columna = { titulo: string; ancho: number; formato?: string };

function hojaTabla(wb: ExcelJS.Workbook, nombre: string, columnas: Columna[], filas: (string | number | Date | null)[][]) {
  const hoja = wb.addWorksheet(nombre, { views: [{ state: "frozen", ySplit: 1 }] });
  hoja.columns = columnas.map((c) => ({ header: c.titulo, width: c.ancho, style: c.formato ? { numFmt: c.formato } : {} }));
  const cab = hoja.getRow(1);
  cab.height = 30;
  cab.eachCell((c) => {
    c.font = { bold: true, size: 10, color: { argb: BLANCO } };
    c.fill = relleno(NAVY);
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });
  for (const f of filas) hoja.addRow(f.map((v) => (v === null ? "" : v)));
  for (let r = 2; r <= hoja.rowCount; r++) {
    const fila = hoja.getRow(r);
    fila.font = { size: 10 };
    fila.alignment = { vertical: "middle", wrapText: true };
    fila.eachCell({ includeEmpty: true }, (c) => {
      if (r % 2 === 0) c.fill = relleno(ZEBRA);
      c.border = { bottom: { style: "hair", color: { argb: LINEA } } };
    });
  }
  if (hoja.rowCount > 1) hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: hoja.rowCount, column: columnas.length } };
  hoja.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
  hoja.headerFooter.oddFooter = `&L&8RedSalud Te Forma · Evaluación presaber / postsaber · ${nombre}&R&8Página &P de &N`;
  return hoja;
}

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 60);

export async function generarExcelResultadosCiclo(
  activityId: string,
  trimestrePedido: string | null
): Promise<{ buffer: Buffer; nombre: string } | null> {
  const actividad = await prisma.trainingActivity.findUnique({
    where: { id: activityId },
    select: {
      id: true,
      title: true,
      quarters: true,
      area: { select: { name: true } },
      plan: { select: { title: true, year: true } },
      sessions: { orderBy: { startsAt: "asc" }, select: { id: true, startsAt: true, endsAt: true, modality: true, status: true } },
    },
  });
  if (!actividad) return null;

  const vista = trimestrePedido ? await trimestresDeActividad(actividad, trimestrePedido) : null;
  const filtro = vista?.filtro ?? null;
  const resultados = await getCycleResults(activityId, filtro);
  const jornadas = actividad.sessions.filter((s) => !filtro || (s.startsAt >= filtro.desde && s.startsAt < filtro.hasta));
  const conteos = await getConteosPorJornada(jornadas.map((j) => j.id));

  const wb = new ExcelJS.Workbook();
  wb.creator = "RedSalud Te Forma";
  wb.created = new Date();

  hojaTabla(
    wb,
    "Por persona",
    [
      { titulo: "Nombre", ancho: 38 },
      { titulo: "Documento", ancho: 16 },
      { titulo: "Presaber (%)", ancho: 13 },
      { titulo: "Postsaber (%)", ancho: 13 },
      { titulo: "Diferencia (pp)", ancho: 15 },
    ],
    (resultados?.personas ?? []).map((p) => [p.fullName, p.documentNumber, p.presaber, p.postsaber, p.diferencia])
  );

  hojaTabla(
    wb,
    "Por pregunta",
    [
      { titulo: "#", ancho: 6 },
      { titulo: "Pregunta", ancho: 70 },
      { titulo: "Acierto presaber (%)", ancho: 18 },
      { titulo: "Acierto postsaber (%)", ancho: 18 },
    ],
    (resultados?.porPregunta ?? []).map((q, i) => [i + 1, q.statement, q.presaber, q.postsaber])
  );

  hojaTabla(
    wb,
    "Por jornada",
    [
      { titulo: "Inicio", ancho: 20, formato: "dd/mm/yyyy hh:mm" },
      { titulo: "Modalidad", ancho: 14 },
      { titulo: "Estado", ancho: 12 },
      { titulo: "Asistentes", ancho: 12 },
      { titulo: "Presaber", ancho: 11 },
      { titulo: "Postsaber", ancho: 11 },
      { titulo: "Invitados", ancho: 11 },
    ],
    jornadas.map((j) => {
      const c = conteos.get(j.id);
      return [
        horaColombia(j.startsAt),
        j.modality === "VIRTUAL" ? "Virtual" : j.modality === "PRESENCIAL" ? "Presencial" : "Mixta",
        j.status === "CLOSED" ? "Cerrada" : j.status === "OPEN" ? "Abierta" : "Borrador",
        c?.asistentes ?? 0,
        c?.presaber ?? 0,
        c?.postsaber ?? 0,
        c?.invitados ?? 0,
      ];
    })
  );

  const info = wb.addWorksheet("Información");
  info.columns = [{ width: 24 }, { width: 70 }];
  const filasInfo: [string, string][] = [
    ["Capacitación", actividad.title],
    ["Área", actividad.area?.name ?? "Sin área"],
    ["Plan", `${actividad.plan.title} (${actividad.plan.year})`],
    ["Trimestre", filtro ? `T${filtro.trimestre}` : "Toda la capacitación"],
    ["Generado", new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeStyle: "short", timeZone: "America/Bogota" }).format(new Date())],
  ];
  for (const [k, v] of filasInfo) {
    const r = info.addRow([k, v]);
    r.getCell(1).font = { bold: true, size: 10, color: { argb: BLANCO } };
    r.getCell(1).fill = relleno(NAVY);
    r.getCell(2).font = { size: 10 };
  }

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  return { buffer, nombre: `presaber-postsaber-${slug(actividad.title)}.xlsx` };
}
