import ExcelJS from "exceljs";

/**
 * Piezas comunes de los Excel de la casa (mismo estilo que
 * lib/trazabilidad-excel.ts y lib/resultados-ciclo-excel.ts): encabezado
 * navy, fila fija, anchos por columna, cebra, autofiltro y hoja de
 * "Información" con el contexto del archivo. Las exportaciones van en Excel,
 * nunca en CSV.
 */

export const NAVY = "FF0F2438";
export const BLANCO = "FFFFFFFF";
export const ZEBRA = "FFF4F7FA";
export const LINEA = "FFDCE3EA";

export const relleno = (argb: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb } });

/** ExcelJS escribe las fechas en UTC: se corren a la hora de Colombia para que la celda muestre la hora local. */
export const horaColombia = (d: Date) => new Date(d.getTime() - 5 * 3600e3);

export type ColumnaExcel = { titulo: string; ancho: number; formato?: string };
export type ValorCelda = string | number | Date | null;

export function hojaTabla(
  wb: ExcelJS.Workbook,
  nombre: string,
  columnas: ColumnaExcel[],
  filas: ValorCelda[][],
  pie = "RedSalud Te Forma"
) {
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
  hoja.headerFooter.oddFooter = `&L&8${pie} · ${nombre}&R&8Página &P de &N`;
  return hoja;
}

/** Hoja "Información": pares clave-valor con el contexto del archivo y la fecha de generación. */
export function hojaInformacion(wb: ExcelJS.Workbook, filas: [string, string][]) {
  const info = wb.addWorksheet("Información");
  info.columns = [{ width: 24 }, { width: 70 }];
  const todas: [string, string][] = [
    ...filas,
    ["Generado", new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeStyle: "short", timeZone: "America/Bogota" }).format(new Date())],
  ];
  for (const [k, v] of todas) {
    const r = info.addRow([k, v]);
    r.getCell(1).font = { bold: true, size: 10, color: { argb: BLANCO } };
    r.getCell(1).fill = relleno(NAVY);
    r.getCell(2).font = { size: 10 };
  }
  return info;
}

export function nuevoLibro() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "RedSalud Te Forma";
  wb.created = new Date();
  return wb;
}

export const slugArchivo = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 60);

/** Respuesta de descarga de un libro de Excel. */
export async function respuestaExcel(wb: ExcelJS.Workbook, nombreArchivo: string): Promise<Response> {
  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
      "Cache-Control": "no-store",
    },
  });
}
