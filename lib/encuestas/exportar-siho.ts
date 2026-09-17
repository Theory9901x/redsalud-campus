import ExcelJS from "exceljs";
import { getFilasSiau, rangoDePeriodo, NOMBRE_MES, type FilaSiau, type Periodo, type PreguntaSiau } from "@/lib/encuestas/metrics";

/**
 * INFORME SIHO (ente de control) en Excel, réplica del formato que el área
 * SIAU entrega: dos hojas.
 *
 *  1. DATOS · una fila por encuesta, una columna por variable y pregunta,
 *     con la respuesta en texto (como la hoja "MARZO" del original).
 *  2. RESUMEN · tabla por IPS con el conteo de cada opción de P5 y P6,
 *     totales, % satisfacción e % insatisfacción con FÓRMULAS de Excel,
 *     fila "Total general" y el bloque de totales globales (como la hoja
 *     "SEGUNDO TRIMESTRE 2026." del original: mismos colores y estructura).
 *
 * Las columnas de P5 y P6 son las opciones vigentes del formato (Word
 * actualizado): Buena, Muy Buena, Regular, Mala, Muy mala · Sí, No.
 * % satisfacción = (Buena + Muy Buena) / Total · % insatisfacción = resto / Total.
 */

const AZUL = "FF00B0F0";
const VERDE = "FF92D050";
const AMARILLO = "FFFFFF00";
const NARANJA = "FFFABF8F";
const CELESTE = "FF88EFFA";
const NAVY = "FF0F2438";
const BLANCO = "FFFFFFFF";
const ZEBRA = "FFF4F7FA";
const LILA = "FFB4C7E7";
const VERDE_CLARO = "FFC6E0B4";

/** Orden de IPS del formato oficial; las demás sedes con datos se anexan al final. */
const IPS_OFICIALES = ["CHAMEZA", "MANI", "MONTERREY", "RECETOR", "SABANALARGA", "VILLANUEVA", "NUNCHIA", "OROCUE", "SAN LUIS DE PALENQUE", "TAMARA", "TRINIDAD", "HATO COROZAL", "PAZ DE ARIPORO", "SACAMA", "LA SALINA", "PORE"];

const ORDINAL_TRIMESTRE = ["PRIMER", "SEGUNDO", "TERCER", "CUARTO"];

export function etiquetaPeriodoSiho(p: Periodo): string {
  if (p.tipo === "mensual") return `MES DE ${NOMBRE_MES[(p.mes ?? 1) - 1].toUpperCase()} DE ${p.anio}`;
  if (p.tipo === "trimestral") {
    const t = p.trimestre ?? 1;
    const meses = [0, 1, 2].map((i) => NOMBRE_MES[(t - 1) * 3 + i].toUpperCase()).join(", ");
    return `${ORDINAL_TRIMESTRE[t - 1]} TRIMESTRE ${p.anio} (${meses})`;
  }
  return `AÑO ${p.anio}`;
}

function sinTildes(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
}

const bordes: Partial<ExcelJS.Borders> = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
const relleno = (color: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb: color } });

export async function generarInformeSiho(periodo: Periodo, filtros: { sede?: string } = {}): Promise<{ buffer: Buffer; nombre: string; total: number } | null> {
  const rango = rangoDePeriodo(periodo);
  const datos = await getFilasSiau({ desde: rango.desde, hasta: rango.hasta, sede: filtros.sede });
  if (!datos) return null;
  const { filas, preguntas } = datos;
  const p5 = preguntas.find((p) => p.clave === "p5");
  const p6 = preguntas.find((p) => p.clave === "p6");
  const opcionesP5 = p5?.opciones ?? [];
  const opcionesP6 = p6?.opciones ?? [];
  const perfiles = preguntas.filter((p) => p.clave.startsWith("p2:"));
  const etiquetaPeriodo = etiquetaPeriodoSiho(periodo);

  const wb = new ExcelJS.Workbook();
  wb.creator = "RedSalud Te Forma";
  wb.created = new Date();

  // ================================================================ hoja 1 · datos crudos
  const hojaDatos = wb.addWorksheet("DATOS", { views: [{ state: "frozen", ySplit: 1 }] });
  const cabecera = [
    "IPS", "FECHA", "SEXO", "EPS:", "SERVICIO(S):",
    ...perfiles.map((p) => `2. TRATO · ${sinTildes(p.perfil ?? "")}`),
    "3. RESPETO A LA INTIMIDAD Y CONFIDENCIALIDAD", "4. LIMPIEZA Y COMODIDAD", "5. SATISFACCION GLOBAL", "6. RECOMENDARIA ESTA IPS", "7. INFORMACION CLARA SOBRE SU ATENCION", "8. TRATO HACIA EL PERSONAL", "9. OBSERVACIONES",
  ];
  hojaDatos.addRow(cabecera);
  hojaDatos.getRow(1).font = { bold: true, size: 9 };
  hojaDatos.getRow(1).alignment = { wrapText: true, vertical: "middle" };
  hojaDatos.getRow(1).height = 42;
  hojaDatos.getRow(1).eachCell((c) => { c.fill = relleno(AZUL); c.border = bordes; });
  const texto = (f: FilaSiau, clave: string) => sinTildes(f.calificaciones[clave]?.texto ?? "");
  for (const f of filas) {
    hojaDatos.addRow([
      sinTildes(f.sede ?? ""),
      new Date(f.fecha.getTime() - 5 * 3600e3),
      f.sexo ? sinTildes(f.sexo) : "",
      sinTildes(f.eps ?? ""),
      f.servicios.map(sinTildes).join(" / ") + (f.servicioOtro ? ` (${f.servicioOtro.toUpperCase()})` : ""),
      ...perfiles.map((p) => texto(f, p.clave)),
      texto(f, "p3"), texto(f, "p4"), texto(f, "p5"), texto(f, "p6"), texto(f, "p7"), texto(f, "p8"),
      f.sugerencia ?? "",
    ]);
  }
  hojaDatos.getColumn(2).numFmt = "dd/mm/yyyy";
  hojaDatos.columns.forEach((col, i) => { col.width = i === 0 ? 22 : i === 1 ? 12 : i === 4 ? 30 : i === cabecera.length - 1 ? 60 : 16; });
  hojaDatos.getRow(1).eachCell((c) => { c.font = { bold: true, size: 9, color: { argb: BLANCO } }; c.fill = relleno(NAVY); c.alignment = { horizontal: "center", vertical: "middle", wrapText: true }; });
  hojaDatos.getRow(1).height = 48;
  for (let r = 2; r <= hojaDatos.rowCount; r++) {
    const fila = hojaDatos.getRow(r);
    fila.font = { size: 9 };
    fila.alignment = { vertical: "middle" };
    if (r % 2 === 0) fila.eachCell({ includeEmpty: true }, (c) => { c.fill = relleno(ZEBRA); });
    fila.eachCell({ includeEmpty: true }, (c) => { c.border = { bottom: { style: "hair", color: { argb: "FFDCE3EA" } } }; });
  }
  if (hojaDatos.rowCount > 1) hojaDatos.autoFilter = { from: { row: 1, column: 1 }, to: { row: hojaDatos.rowCount, column: cabecera.length } };
  hojaDatos.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
  hojaDatos.headerFooter.oddFooter = "&L&8RedSalud Te Forma · Encuesta SIAU&R&8Página &P de &N";

  // ================================================================ hoja 2 · resumen por IPS
  const hoja = wb.addWorksheet(etiquetaPeriodo.slice(0, 31).replace(/[\\/?*[\]:]/g, " "));
  const nP5 = opcionesP5.length;
  const nP6 = opcionesP6.length;
  const colIni5 = 2; // B
  const colTot5 = colIni5 + nP5; // Total P5
  const colIni6 = colTot5 + 1;
  const colTot6 = colIni6 + nP6;
  const colSat = colTot6 + 1;
  const colIns = colSat + 1;
  const L = (n: number) => hoja.getColumn(n).letter;

  hoja.mergeCells(1, 1, 1, colIns);
  hoja.getCell(1, 1).value = "SIHO (ENCUESTAS DE SATISFACCION)";
  hoja.mergeCells(2, 1, 2, colIns);
  hoja.getCell(2, 1).value = etiquetaPeriodo;
  hoja.getCell(1, 1).font = { bold: true, size: 14, color: { argb: BLANCO } };
  hoja.getCell(2, 1).font = { bold: true, size: 11, color: { argb: BLANCO } };
  for (const r of [1, 2]) {
    hoja.getCell(r, 1).alignment = { horizontal: "center", vertical: "middle" };
    for (let c = 1; c <= colIns; c++) hoja.getCell(r, c).fill = relleno(NAVY);
  }
  hoja.getRow(1).height = 26;
  hoja.getRow(2).height = 20;
  hoja.views = [{ state: "frozen", xSplit: 1, ySplit: 4, showGridLines: false }];
  hoja.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } };
  hoja.headerFooter.oddFooter = "&L&8Red Salud Casanare E.S.E. · SIAU · " + etiquetaPeriodo + "&R&8Página &P de &N";

  // fila 3-4: cabeceras
  hoja.mergeCells(3, 1, 4, 1);
  hoja.getCell(3, 1).value = "IPS";
  hoja.mergeCells(3, colIni5, 3, colTot5);
  hoja.getCell(3, colIni5).value = "EN GENERAL, CONSIDERA QUE LA ATENCION BRINDADA EN LA INSTITUCION FUE:";
  hoja.mergeCells(3, colIni6, 3, colTot6);
  hoja.getCell(3, colIni6).value = "RECOMENDARIA A SUS FAMILIARES Y AMIGOS ESTA IPS?";
  hoja.mergeCells(3, colSat, 4, colSat);
  hoja.getCell(3, colSat).value = "% SATISFACCIÓN";
  hoja.mergeCells(3, colIns, 4, colIns);
  hoja.getCell(3, colIns).value = "% INSATISFACCIÓN";
  opcionesP5.forEach((o, i) => { hoja.getCell(4, colIni5 + i).value = sinTildes(o.texto); });
  hoja.getCell(4, colTot5).value = "Total";
  opcionesP6.forEach((o, i) => { hoja.getCell(4, colIni6 + i).value = sinTildes(o.texto); });
  hoja.getCell(4, colTot6).value = "Total";
  for (let c = 1; c <= colIns; c++) {
    for (const r of [3, 4]) {
      const cel = hoja.getCell(r, c);
      cel.font = { bold: true, size: 9 };
      cel.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cel.border = bordes;
      cel.fill = relleno(c === 1 || (c >= colIni5 && c <= colTot5) ? (r === 3 || c === 1 ? AZUL : LILA) : c >= colIni6 && c <= colTot6 ? (r === 3 ? VERDE : VERDE_CLARO) : c === colSat ? AMARILLO : NARANJA);
    }
  }
  hoja.getRow(3).height = 34;
  hoja.getRow(4).height = 30;

  // filas por IPS
  const conteo = new Map<string, { p5: number[]; p6: number[] }>();
  const asegurar = (ips: string) => { if (!conteo.has(ips)) conteo.set(ips, { p5: opcionesP5.map(() => 0), p6: opcionesP6.map(() => 0) }); return conteo.get(ips)!; };
  for (const ips of IPS_OFICIALES) asegurar(ips);
  for (const f of filas) {
    const ips = sinTildes(f.sede ?? "SIN SEDE");
    const c = asegurar(ips);
    const r5 = f.calificaciones.p5; if (r5) { const i = opcionesP5.findIndex((o) => o.id === r5.opcionId); if (i >= 0) c.p5[i]++; }
    const r6 = f.calificaciones.p6; if (r6) { const i = opcionesP6.findIndex((o) => o.id === r6.opcionId); if (i >= 0) c.p6[i]++; }
  }
  const ipsOrden = [...IPS_OFICIALES, ...[...conteo.keys()].filter((k) => !IPS_OFICIALES.includes(k)).sort()];
  const filaIni = 5;
  // Mismo criterio que el centro de datos y el PDF: favorable = Buena + Muy
  // buena sobre las respuestas VÁLIDAS. "No responde"/"No aplica" (tono na)
  // se reporta en su columna y en el Total, pero no se mide: se resta del
  // denominador y no cuenta como insatisfacción.
  const esFav = (o: { tono?: string }) => o.tono === "exc" || o.tono === "bue";
  const esNa = (o: { tono?: string }) => o.tono === "na";
  const favorables5 = opcionesP5.map((o, i) => ({ i, o })).filter((x) => esFav(x.o)).map((x) => L(colIni5 + x.i));
  const desfavorables5 = opcionesP5.map((o, i) => ({ i, o })).filter((x) => !esFav(x.o) && !esNa(x.o)).map((x) => L(colIni5 + x.i));
  const noMedidas5 = opcionesP5.map((o, i) => ({ i, o })).filter((x) => esNa(x.o)).map((x) => L(colIni5 + x.i));
  const validas5 = (r: number) => (noMedidas5.length === 0 ? `${L(colTot5)}${r}` : `(${L(colTot5)}${r}-${noMedidas5.map((l) => `${l}${r}`).join("-")})`);
  ipsOrden.forEach((ips, idx) => {
    const r = filaIni + idx;
    const c = conteo.get(ips)!;
    hoja.getCell(r, 1).value = ips;
    c.p5.forEach((n, i) => { hoja.getCell(r, colIni5 + i).value = n; });
    hoja.getCell(r, colTot5).value = { formula: c.p5.map((_, i) => `${L(colIni5 + i)}${r}`).join("+") };
    c.p6.forEach((n, i) => { hoja.getCell(r, colIni6 + i).value = n; });
    hoja.getCell(r, colTot6).value = { formula: c.p6.map((_, i) => `${L(colIni6 + i)}${r}`).join("+") };
    hoja.getCell(r, colSat).value = { formula: `IFERROR((${favorables5.map((l) => `${l}${r}`).join("+")})/${validas5(r)},0)` };
    hoja.getCell(r, colIns).value = { formula: `IFERROR((${desfavorables5.map((l) => `${l}${r}`).join("+")})/${validas5(r)},0)` };
    for (let col = 1; col <= colIns; col++) {
      const cel = hoja.getCell(r, col);
      cel.border = bordes;
      cel.font = { size: 9 };
      if (col > 1) cel.alignment = { horizontal: "center" };
      if (col >= colIni5 && col < colTot5) cel.fill = relleno(CELESTE);
      if (col >= colIni6 && col < colTot6) cel.fill = relleno(CELESTE);
      if (col === colTot5) cel.fill = relleno(LILA);
      if (col === colTot6) cel.fill = relleno(VERDE_CLARO);
      if (col === colSat || col === colIns) cel.numFmt = "0%";
      if (col === 1) { cel.font = { size: 9, bold: true }; cel.alignment = { horizontal: "left", vertical: "middle", indent: 1 }; }
      else cel.alignment = { horizontal: "center", vertical: "middle" };
    }
    hoja.getRow(r).height = 17;
    // Semáforo institucional en el % de satisfacción: verde ≥ 85, ámbar 70–84, rojo < 70.
    const tot = opcionesP5.reduce((a, o, i) => a + (esNa(o) ? 0 : c.p5[i]), 0);
    const fav = opcionesP5.reduce((a, o, i) => a + (esFav(o) ? c.p5[i] : 0), 0);
    const pctSat = tot > 0 ? fav / tot : null;
    const celSat = hoja.getCell(r, colSat);
    celSat.font = { size: 9, bold: true, color: { argb: pctSat === null ? "FF6B7C8F" : pctSat >= 0.85 ? "FF16A44E" : pctSat >= 0.7 ? "FFB7791F" : "FFD6483B" } };
    hoja.getCell(r, colIns).font = { size: 9, bold: true, color: { argb: pctSat === null ? "FF6B7C8F" : pctSat >= 0.85 ? "FF16A44E" : pctSat >= 0.7 ? "FFB7791F" : "FFD6483B" } };
  });
  const filaTot = filaIni + ipsOrden.length;
  hoja.getCell(filaTot, 1).value = "Total general";
  for (let col = colIni5; col <= colTot6; col++) hoja.getCell(filaTot, col).value = { formula: `SUM(${L(col)}${filaIni}:${L(col)}${filaTot - 1})` };
  hoja.getCell(filaTot, colSat).value = { formula: `IFERROR((${favorables5.map((l) => `${l}${filaTot}`).join("+")})/${validas5(filaTot)},0)` };
  hoja.getCell(filaTot, colIns).value = { formula: `IFERROR((${desfavorables5.map((l) => `${l}${filaTot}`).join("+")})/${validas5(filaTot)},0)` };
  for (let col = 1; col <= colIns; col++) {
    const cel = hoja.getCell(filaTot, col);
    cel.font = { bold: true, size: 10 };
    cel.border = bordes;
    cel.alignment = { horizontal: "center" };
    cel.fill = relleno(col === colSat ? AMARILLO : col === colIns ? NARANJA : col >= colIni6 ? VERDE_CLARO : LILA);
    if (col === colSat || col === colIns) cel.numFmt = "0%";
    if (col === 1) cel.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  }
  hoja.getRow(filaTot).height = 20;

  // bloque global
  const b = filaTot + 3;
  hoja.mergeCells(b, 1, b, 4); hoja.getCell(b, 1).value = "TOTAL DE ENCUESTAS DE SATISFACCION REALIZADAS";
  hoja.getCell(b, 5).value = { formula: `${L(colTot5)}${filaTot}` };
  hoja.mergeCells(b + 1, 1, b + 1, 4); hoja.getCell(b + 1, 1).value = "PORCENTAJE DE SATISFACCION GLOBAL";
  hoja.getCell(b + 1, 5).value = { formula: `${L(colSat)}${filaTot}` };
  hoja.mergeCells(b + 2, 1, b + 2, 4); hoja.getCell(b + 2, 1).value = "PORCENTAJE DE INSATISFACCION GLOBAL";
  hoja.getCell(b + 2, 5).value = { formula: `${L(colIns)}${filaTot}` };
  for (const [r, colorEt, colorVal] of [[b, LILA, AMARILLO], [b + 1, VERDE, "FFBFBFBF"], [b + 2, "FFFFF2CC", "FFFFF2CC"]] as [number, string, string][]) {
    hoja.getCell(r, 1).font = { bold: true, size: 10 }; hoja.getCell(r, 1).fill = relleno(colorEt); hoja.getCell(r, 1).border = bordes;
    const v = hoja.getCell(r, 5); v.font = { bold: true, size: 10 }; v.fill = relleno(colorVal); v.border = bordes; v.alignment = { horizontal: "center" };
    if (r !== b) v.numFmt = "0%";
  }
  for (const r of [b, b + 1, b + 2]) hoja.getRow(r).height = 18;
  hoja.getCell(b + 4, 1).value = "Semáforo institucional del % de satisfacción: verde ≥ 85 %, ámbar 70–84,9 %, rojo < 70 %. % satisfacción = (Buena + Muy Buena) / respuestas válidas · % insatisfacción = (Regular + Mala + Muy mala) / respuestas válidas. Respuestas válidas = Total − No responde (no se mide).";
  hoja.getCell(b + 4, 1).font = { size: 8, color: { argb: "FF6B7C8F" } };
  hoja.getCell(b + 5, 1).value = `Generado por RedSalud Te Forma el ${new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" })} · ${filas.length} encuestas · PM-7-SIAU-PR-02 V.1`;
  hoja.getCell(b + 5, 1).font = { italic: true, size: 8, color: { argb: "FF6B7C8F" } };

  hoja.getColumn(1).width = 22;
  for (let col = 2; col <= colTot6; col++) hoja.getColumn(col).width = 12;
  hoja.getColumn(colSat).width = 16;
  hoja.getColumn(colIns).width = 18;

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  const hoy = new Date().toISOString().slice(0, 10);
  return { buffer, nombre: `SIAU_SIHO_${rango.clave}_${hoy}.xlsx`, total: filas.length };
}

export type { PreguntaSiau };
