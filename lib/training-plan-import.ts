import ExcelJS from "exceljs";
import type { TrainingActivityType, CourseAudience } from "@prisma/client";

/**
 * Plantilla del cronograma: una fila por capacitación del plan. Los planes de
 * capacitación no se vinculan a cursos, así que la plantilla no trae columnas
 * de tipo ni de curso.
 */
export const IMPORT_TEMPLATE_HEADERS = [
  "Título",
  "Fecha inicio (DD/MM/AAAA)",
  "Fecha fin (opcional, DD/MM/AAAA)",
  "Dirigido a (Administrativo / Asistencial / Ambos)",
  "Obligatoria (Sí/No)",
];

export const IMPORT_TEMPLATE_EXAMPLE_ROW = [
  "Ejemplo: Inducción institucional (borra esta fila antes de subir)",
  "01/09/2026",
  "",
  "Ambos",
  "Sí",
];

export type ParsedActivityRow = {
  title: string;
  type: TrainingActivityType;
  startDate: Date;
  endDate: Date | null;
  targetAudience: CourseAudience;
  isRequired: boolean;
};

export type ImportRowError = { row: number; message: string };

function parseSpanishDate(raw: string): Date | null {
  const match = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function normalize(value: unknown): string {
  if (value instanceof Date) return value.toLocaleDateString("es-CO");
  return String(value ?? "").trim();
}

const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

type Columnas = { titulo: number; tipo: number | null; inicio: number; fin: number; dirigido: number; obligatoria: number };

/** Plantilla actual (5 columnas, sin tipo ni curso). */
const COLUMNAS_ACTUALES: Columnas = { titulo: 1, tipo: null, inicio: 2, fin: 3, dirigido: 4, obligatoria: 5 };
/** Plantilla anterior (7 columnas: Título, Tipo, Curso vinculado, Fecha inicio, Fecha fin, Dirigido a, Obligatoria). */
const COLUMNAS_ANTERIORES: Columnas = { titulo: 1, tipo: 2, inicio: 4, fin: 5, dirigido: 6, obligatoria: 7 };

/**
 * Ubica las columnas por sus encabezados, para aceptar tanto la plantilla
 * actual como archivos llenados con la anterior (que traían «Tipo» y «Curso
 * vinculado»). La columna de curso se IGNORA: la importación nunca vincula
 * cursos.
 */
function columnasDe(encabezados: string[]): Columnas {
  const buscar = (prueba: (h: string) => boolean) => {
    const i = encabezados.findIndex((h) => prueba(sinTildes(h)));
    return i >= 0 ? i + 1 : null;
  };
  const titulo = buscar((h) => h.startsWith("titulo"));
  const inicio = buscar((h) => h.includes("fecha inicio"));
  const fin = buscar((h) => h.includes("fecha fin"));
  const dirigido = buscar((h) => h.includes("dirigido"));
  const obligatoria = buscar((h) => h.includes("obligatori"));
  if (titulo && inicio && fin && dirigido && obligatoria) {
    return { titulo, tipo: buscar((h) => h.startsWith("tipo")), inicio, fin, dirigido, obligatoria };
  }
  // Sin encabezados reconocibles: se decide por el ancho de la hoja.
  const anterior = encabezados.length >= 7 || encabezados.some((h) => sinTildes(h).includes("curso"));
  return anterior ? COLUMNAS_ANTERIORES : COLUMNAS_ACTUALES;
}

/** Parsea el buffer subido (.xlsx) fila por fila. No aborta el lote entero por una fila mala: junta válidas y errores. */
export async function parseTrainingScheduleFile(buffer: Buffer): Promise<{ valid: ParsedActivityRow[]; errors: ImportRowError[] }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return { valid: [], errors: [{ row: 0, message: "El archivo no tiene ninguna hoja." }] };
  }

  const cabecera = sheet.getRow(1);
  const encabezados: string[] = [];
  for (let c = 1; c <= Math.max(cabecera.cellCount, 1); c++) encabezados.push(normalize(cabecera.getCell(c).value));
  const col = columnasDe(encabezados);

  const valid: ParsedActivityRow[] = [];
  const errors: ImportRowError[] = [];

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return; // encabezados

    const title = normalize(row.getCell(col.titulo).value);
    if (!title) return; // fila vacía, se ignora silenciosamente

    const typeRaw = col.tipo ? sinTildes(normalize(row.getCell(col.tipo).value)) : "";
    const startRaw = normalize(row.getCell(col.inicio).value);
    const endRaw = normalize(row.getCell(col.fin).value);
    const audienceRaw = normalize(row.getCell(col.dirigido).value).toLowerCase();
    const requiredRaw = normalize(row.getCell(col.obligatoria).value).toLowerCase();

    // Los archivos con la plantilla anterior pueden traer «Evento externo»;
    // todo lo demás es una capacitación del plan. El curso vinculado no se lee.
    const type: TrainingActivityType = typeRaw.includes("evento") || typeRaw.includes("externo") ? "EXTERNAL_EVENT" : "COURSE";

    const startDate = parseSpanishDate(startRaw);
    if (!startDate) {
      errors.push({ row: rowNumber, message: `Fecha de inicio inválida: "${startRaw}". Usa el formato DD/MM/AAAA.` });
      return;
    }

    let endDate: Date | null = null;
    if (endRaw) {
      endDate = parseSpanishDate(endRaw);
      if (!endDate) {
        errors.push({ row: rowNumber, message: `Fecha de fin inválida: "${endRaw}". Usa el formato DD/MM/AAAA o déjala vacía.` });
        return;
      }
    }

    let targetAudience: CourseAudience;
    if (audienceRaw.startsWith("admin")) targetAudience = "ADMINISTRATIVO";
    else if (audienceRaw.startsWith("asist")) targetAudience = "ASISTENCIAL";
    else if (audienceRaw.startsWith("ambos")) targetAudience = "AMBOS";
    else {
      errors.push({ row: rowNumber, message: `Audiencia inválida: "${audienceRaw}". Usa "Administrativo", "Asistencial" o "Ambos".` });
      return;
    }

    const isRequired = requiredRaw.startsWith("s") || requiredRaw === "si" || requiredRaw === "sí";

    valid.push({ title, type, startDate, endDate, targetAudience, isRequired });
  });

  return { valid, errors };
}

export async function buildTrainingScheduleTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Cronograma");
  sheet.addRow(IMPORT_TEMPLATE_HEADERS);
  sheet.getRow(1).font = { bold: true };
  sheet.addRow(IMPORT_TEMPLATE_EXAMPLE_ROW);
  sheet.columns.forEach((column) => {
    column.width = 32;
  });
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
