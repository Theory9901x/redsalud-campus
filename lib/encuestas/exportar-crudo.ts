import ExcelJS from "exceljs";
import { getFilasSiau, rangoDePeriodo, type Periodo } from "@/lib/encuestas/metrics";

/**
 * DATOS CRUDOS de la SIAU en Excel: una fila por encuesta, una columna por
 * variable y por pregunta, con el VALOR numérico (0–4) y la ETIQUETA de
 * cada calificación, más una hoja "Diccionario" que explica la escala.
 */
export async function generarDatosCrudos(periodo: Periodo, filtros: { sede?: string; servicio?: string; sexo?: string; eps?: string } = {}) {
  const rango = rangoDePeriodo(periodo);
  const datos = await getFilasSiau({ ...filtros, desde: rango.desde, hasta: rango.hasta });
  if (!datos) return null;
  const { filas, preguntas } = datos;
  const claves = preguntas.filter((p) => p.clave.startsWith("p2:") || /^p[3-8]$/.test(p.clave));

  const wb = new ExcelJS.Workbook();
  wb.creator = "RedSalud Te Forma";
  const ws = wb.addWorksheet("Datos crudos", { views: [{ state: "frozen", ySplit: 1, xSplit: 2 }] });
  const cab = ["ID respuesta", "Fecha", "Hora", "Canal", "Sede / municipio", "Sexo", "EPS", "Servicios", "Servicio otro"];
  for (const p of claves) {
    const nombre = p.perfil ? `P2 ${p.perfil}` : `P${p.numero}`;
    cab.push(`${nombre} · valor`, `${nombre} · etiqueta`);
  }
  cab.push("P9 sugerencia");
  ws.addRow(cab);
  ws.getRow(1).font = { bold: true, size: 9 };
  ws.getRow(1).alignment = { wrapText: true, vertical: "middle" };
  ws.getRow(1).height = 36;
  ws.getRow(1).eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCE3EA" } }; });
  for (const f of filas) {
    const local = new Date(f.fecha.getTime() - 5 * 3600e3);
    const fila: (string | number | Date | null)[] = [
      f.responseId,
      new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate())),
      `${String(local.getUTCHours()).padStart(2, "0")}:${String(local.getUTCMinutes()).padStart(2, "0")}`,
      f.canal ?? "",
      f.sede ?? "",
      f.sexo ?? "",
      f.eps ?? "",
      f.servicios.join(" | "),
      f.servicioOtro ?? "",
    ];
    for (const p of claves) {
      const c = f.calificaciones[p.clave];
      fila.push(c ? (c.valor ?? null) : null, c ? c.texto : "");
    }
    fila.push(f.sugerencia ?? "");
    ws.addRow(fila);
  }
  ws.getColumn(2).numFmt = "dd/mm/yyyy";
  ws.columns.forEach((c, i) => { c.width = i === 0 ? 26 : i === 4 || i === 6 || i === 7 ? 22 : i === cab.length - 1 ? 50 : 12; });

  const dic = wb.addWorksheet("Diccionario");
  dic.addRows([
    ["Escala de valores (backend)", ""],
    ["Excelente / Muy buena / Sí", 4],
    ["Bueno / Buena", 3],
    ["Regular", 2],
    ["Malo / Mala", 1],
    ["Muy malo / No", 0],
    ["No aplica", "sin valor (no cuenta en válidas)"],
    ["", ""],
    ["Adherencia %", "favorables (4 y 3) / válidas × 100 · Resolución 0256 de 2016"],
    ["Puntaje %", "promedio del valor / máximo de la escala × 100"],
    ["Semáforo", "verde ≥ 85 % · amarillo 70–84,9 % · rojo < 70 %"],
    ["", ""],
    ["Preguntas", ""],
    ...preguntas.filter((p) => !p.clave.startsWith("p2:")).map((p) => [`P${p.numero}`, p.enunciado]),
    ["P2", "Trato del personal, una columna por perfil (13)"],
  ]);
  dic.getColumn(1).width = 30;
  dic.getColumn(2).width = 90;
  dic.getRow(1).font = { bold: true };
  dic.getRow(13).font = { bold: true };

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  const hoy = new Date().toISOString().slice(0, 10);
  return { buffer, nombre: `SIAU_DATOS_${rango.clave}_${hoy}.xlsx`, total: filas.length };
}
