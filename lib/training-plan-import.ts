import ExcelJS from "exceljs";
import { getLinkableCourses } from "@/lib/training-plans";
import type { TrainingActivityType, CourseAudience } from "@prisma/client";

export const IMPORT_TEMPLATE_HEADERS = [
  "Título",
  "Tipo (Curso de la plataforma / Evento externo)",
  "Curso vinculado (título exacto o No aplica)",
  "Fecha inicio (DD/MM/AAAA)",
  "Fecha fin (opcional, DD/MM/AAAA)",
  "Dirigido a (Administrativo / Asistencial / Ambos)",
  "Obligatoria (Sí/No)",
];

export const IMPORT_TEMPLATE_EXAMPLE_ROW = [
  "Ejemplo: Inducción institucional (borra esta fila antes de subir)",
  "Curso de la plataforma",
  "No aplica",
  "01/09/2026",
  "",
  "Ambos",
  "Sí",
];

export type ParsedActivityRow = {
  title: string;
  type: TrainingActivityType;
  courseId: string | null;
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

/** Parsea el buffer subido (.xlsx) fila por fila. No aborta el lote entero por una fila mala: junta válidas y errores. */
export async function parseTrainingScheduleFile(buffer: Buffer): Promise<{ valid: ParsedActivityRow[]; errors: ImportRowError[] }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return { valid: [], errors: [{ row: 0, message: "El archivo no tiene ninguna hoja." }] };
  }

  const linkableCourses = await getLinkableCourses();
  const courseByTitle = new Map(linkableCourses.map((c) => [c.title.trim().toLowerCase(), c.id]));

  const valid: ParsedActivityRow[] = [];
  const errors: ImportRowError[] = [];

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return; // encabezados

    const title = normalize(row.getCell(1).value);
    if (!title) return; // fila vacía, se ignora silenciosamente

    const typeRaw = normalize(row.getCell(2).value).toLowerCase();
    const courseRaw = normalize(row.getCell(3).value);
    const startRaw = normalize(row.getCell(4).value);
    const endRaw = normalize(row.getCell(5).value);
    const audienceRaw = normalize(row.getCell(6).value).toLowerCase();
    const requiredRaw = normalize(row.getCell(7).value).toLowerCase();

    let type: TrainingActivityType;
    if (typeRaw.includes("curso")) type = "COURSE";
    else if (typeRaw.includes("evento") || typeRaw.includes("externo")) type = "EXTERNAL_EVENT";
    else {
      errors.push({ row: rowNumber, message: `Tipo inválido: "${typeRaw}". Usa "Curso de la plataforma" o "Evento externo".` });
      return;
    }

    let courseId: string | null = null;
    if (type === "COURSE" && courseRaw && courseRaw.toLowerCase() !== "no aplica") {
      const found = courseByTitle.get(courseRaw.toLowerCase());
      if (!found) {
        errors.push({ row: rowNumber, message: `Curso no encontrado: "${courseRaw}". Debe coincidir exactamente con el título de un curso publicado, o usar "No aplica".` });
        return;
      }
      courseId = found;
    }

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

    valid.push({ title, type, courseId, startDate, endDate, targetAudience, isRequired });
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
