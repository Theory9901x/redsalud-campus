import ExcelJS from "exceljs";

/**
 * EVALUACIÓN PRESABER / POSTSABER DESDE EXCEL.
 *
 * El área puede armar su evaluación en una plantilla de Excel y cargarla en
 * la capacitación, en vez de escribir pregunta por pregunta. Aquí viven las
 * dos mitades: la PLANTILLA que se descarga y el LECTOR que la interpreta.
 *
 * El lector es tolerante a propósito (lo llena gente que no es de sistemas):
 * ubica las columnas por el nombre del encabezado, acepta el tipo escrito de
 * varias formas o lo deduce si viene vacío, y nunca falla entero por una
 * fila mala: devuelve las preguntas válidas y, aparte, qué fila tiene qué
 * problema, para mostrarlo antes de guardar nada.
 */

export type TipoPregunta = "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE" | "OPEN_TEXT";

export type PreguntaImportada = {
  /** Fila de Excel de donde salió (para señalar errores). */
  fila: number;
  type: TipoPregunta;
  statement: string;
  options: { text: string; isCorrect: boolean }[];
  score: number;
  explanation: string;
  expectedAnswer: string;
};

export type ErrorImportacion = { fila: number; mensaje: string };

export const TIPOS_EXCEL: { etiqueta: string; tipo: TipoPregunta }[] = [
  { etiqueta: "Única respuesta", tipo: "SINGLE_CHOICE" },
  { etiqueta: "Varias respuestas", tipo: "MULTIPLE_CHOICE" },
  { etiqueta: "Verdadero o falso", tipo: "TRUE_FALSE" },
  { etiqueta: "Abierta", tipo: "OPEN_TEXT" },
];

const LETRAS = ["A", "B", "C", "D", "E", "F"];
const HOJA = "Preguntas";
const MAX_PREGUNTAS = 200;
export const MAX_BYTES_EXCEL = 5 * 1024 * 1024;

const COLUMNAS = [
  { clave: "pregunta", titulo: "Pregunta", ancho: 60 },
  { clave: "tipo", titulo: "Tipo", ancho: 20 },
  ...LETRAS.map((l) => ({ clave: `op${l}`, titulo: `Opción ${l}`, ancho: 28 })),
  { clave: "correcta", titulo: "Respuesta correcta", ancho: 20 },
  { clave: "puntos", titulo: "Puntos", ancho: 9 },
  { clave: "retro", titulo: "Retroalimentación (opcional)", ancho: 44 },
];

const EJEMPLOS: (string | number)[][] = [
  ["EJEMPLO: ¿Cuántos momentos tiene la higiene de manos según la OMS?", "Única respuesta", "Tres", "Cinco", "Siete", "Diez", "", "", "B", 1, "Son cinco: antes del contacto, antes de una tarea aséptica, después de fluidos, después del contacto y después del entorno."],
  ["EJEMPLO: Selecciona los identificadores válidos del paciente.", "Varias respuestas", "Nombre completo", "Número de habitación", "Número de documento", "Diagnóstico", "", "", "A, C", 1, ""],
  ["EJEMPLO: El lavado de manos con agua y jabón debe durar entre 40 y 60 segundos.", "Verdadero o falso", "", "", "", "", "", "", "Verdadero", 1, ""],
  ["EJEMPLO: Describe qué harías si identificas un evento adverso.", "Abierta", "", "", "", "", "", "", "Reportarlo en el aplicativo e informar al jefe inmediato.", 1, ""],
];

/** La plantilla que el área descarga, llena y vuelve a cargar. */
export async function plantillaEvaluacionExcel(): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  libro.creator = "RedSalud Te Forma";

  const hoja = libro.addWorksheet(HOJA, { views: [{ state: "frozen", ySplit: 1 }] });
  hoja.columns = COLUMNAS.map((c) => ({ header: c.titulo, key: c.clave, width: c.ancho }));
  const cabecera = hoja.getRow(1);
  cabecera.height = 30;
  cabecera.eachCell((celda) => {
    celda.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0079AD" } };
    celda.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
  for (const fila of EJEMPLOS) {
    const r = hoja.addRow(fila);
    r.eachCell((celda) => {
      celda.font = { italic: true, color: { argb: "FF6B7C8C" } };
      celda.alignment = { vertical: "top", wrapText: true };
    });
  }
  const colTipo = COLUMNAS.findIndex((c) => c.clave === "tipo") + 1;
  const colPuntos = COLUMNAS.findIndex((c) => c.clave === "puntos") + 1;
  for (let f = 2; f <= MAX_PREGUNTAS + 1; f++) {
    hoja.getCell(f, colTipo).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [`"${TIPOS_EXCEL.map((t) => t.etiqueta).join(",")}"`],
      showErrorMessage: true,
      errorTitle: "Tipo de pregunta",
      error: "Elige uno de la lista.",
    };
    hoja.getCell(f, colPuntos).dataValidation = { type: "whole", operator: "between", allowBlank: true, formulae: [1, 100], showErrorMessage: true, errorTitle: "Puntos", error: "Un número entre 1 y 100." };
    if (f > EJEMPLOS.length + 1) hoja.getRow(f).alignment = { vertical: "top", wrapText: true };
  }

  const ayuda = libro.addWorksheet("Instrucciones");
  ayuda.columns = [{ width: 110 }];
  const lineas: [string, boolean?][] = [
    ["Cómo llenar la evaluación presaber / postsaber", true],
    [""],
    ["1. Escribe una pregunta por fila en la hoja «Preguntas». No cambies los títulos de las columnas."],
    ["2. Las filas que empiezan por «EJEMPLO:» son de muestra: se ignoran al cargar. Puedes borrarlas o escribir encima."],
    ["3. Tipo: elígelo de la lista. Si lo dejas vacío, la plataforma lo deduce de las opciones y de la respuesta."],
    ["     · Única respuesta: varias opciones y una sola correcta."],
    ["     · Varias respuestas: varias opciones y dos o más correctas."],
    ["     · Verdadero o falso: no escribas opciones; en «Respuesta correcta» pon Verdadero o Falso."],
    ["     · Abierta: sin opciones. En «Respuesta correcta» puedes escribir la respuesta esperada (opcional)."],
    ["4. Opciones: usa las columnas Opción A, B, C… en orden, sin dejar huecos. Mínimo dos."],
    ["5. Respuesta correcta: la letra de la opción (por ejemplo B). Si son varias, sepáralas con coma: A, C."],
    ["6. Puntos: cuánto vale la pregunta. Si lo dejas vacío vale 1."],
    ["7. Retroalimentación: explicación que la persona ve después de responder. Es opcional."],
    [""],
    ["La misma evaluación se presenta dos veces: antes de la capacitación (presaber) y después (postsaber)."],
    ["Guarda el archivo en formato Excel (.xlsx) y cárgalo en la capacitación, pestaña «Evaluación»."],
  ];
  for (const [texto, titulo] of lineas) {
    const r = ayuda.addRow([texto]);
    r.getCell(1).alignment = { wrapText: true, vertical: "top" };
    if (titulo) r.getCell(1).font = { bold: true, size: 14, color: { argb: "FF0079AD" } };
  }

  return Buffer.from(await libro.xlsx.writeBuffer());
}

const normalizar = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function texto(valor: ExcelJS.CellValue): string {
  if (valor === null || valor === undefined) return "";
  if (typeof valor === "string") return valor.trim();
  if (typeof valor === "number" || typeof valor === "boolean") return String(valor);
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  if (typeof valor === "object") {
    if ("richText" in valor && Array.isArray(valor.richText)) return valor.richText.map((p) => p.text).join("").trim();
    if ("result" in valor) return texto(valor.result as ExcelJS.CellValue);
    if ("text" in valor) return String(valor.text ?? "").trim();
  }
  return "";
}

function tipoDesdeTexto(t: string): TipoPregunta | null {
  const n = normalizar(t);
  if (!n) return null;
  if (n.includes("verdadero") || n.includes("falso") || n === "v f" || n === "vf") return "TRUE_FALSE";
  if (n.includes("abierta") || n.includes("texto")) return "OPEN_TEXT";
  if (n.includes("varias") || n.includes("multiple")) return "MULTIPLE_CHOICE";
  if (n.includes("unica") || n.includes("una") || n.includes("seleccion")) return "SINGLE_CHOICE";
  return null;
}

function verdaderoOFalso(t: string): boolean | null {
  const n = normalizar(t);
  if (["verdadero", "v", "si", "cierto", "true"].includes(n)) return true;
  if (["falso", "f", "no", "false"].includes(n)) return false;
  return null;
}

/** Lee el Excel cargado. No guarda nada: solo interpreta y valida. */
export async function leerEvaluacionExcel(datos: ArrayBuffer): Promise<{ preguntas: PreguntaImportada[]; errores: ErrorImportacion[] }> {
  const libro = new ExcelJS.Workbook();
  try {
    await libro.xlsx.load(datos);
  } catch {
    return { preguntas: [], errores: [{ fila: 0, mensaje: "No se pudo abrir el archivo. Debe ser un Excel (.xlsx), como la plantilla." }] };
  }
  const hoja = libro.getWorksheet(HOJA) ?? libro.worksheets[0];
  if (!hoja) return { preguntas: [], errores: [{ fila: 0, mensaje: "El archivo no tiene hojas." }] };

  // Encabezados: la primera fila (de las 10 primeras) que tenga «Pregunta».
  let filaCabecera = 0;
  const col: Record<string, number> = {};
  for (let f = 1; f <= Math.min(10, hoja.rowCount) && !filaCabecera; f++) {
    hoja.getRow(f).eachCell((celda, c) => {
      const n = normalizar(texto(celda.value));
      if (n === "pregunta" || n === "enunciado") col.pregunta = c;
      else if (n === "tipo" || n.startsWith("tipo de")) col.tipo = c;
      else if (n.startsWith("respuesta correcta") || n === "correcta" || n === "respuesta") col.correcta = c;
      else if (n.startsWith("puntos") || n === "puntaje" || n === "valor") col.puntos = c;
      else if (n.startsWith("retroalimentacion") || n.startsWith("explicacion")) col.retro = c;
      else {
        const m = n.match(/^opcion ([a-f])$/);
        if (m) col[`op${m[1].toUpperCase()}`] = c;
      }
    });
    if (col.pregunta) filaCabecera = f;
    else for (const k of Object.keys(col)) delete col[k];
  }
  if (!filaCabecera) {
    return { preguntas: [], errores: [{ fila: 0, mensaje: "No se encontró la columna «Pregunta». Usa la plantilla sin cambiar los títulos de las columnas." }] };
  }

  const preguntas: PreguntaImportada[] = [];
  const errores: ErrorImportacion[] = [];
  const celda = (fila: ExcelJS.Row, clave: string) => (col[clave] ? texto(fila.getCell(col[clave]).value) : "");

  for (let f = filaCabecera + 1; f <= hoja.rowCount; f++) {
    const fila = hoja.getRow(f);
    const statement = celda(fila, "pregunta");
    const opciones = LETRAS.map((l) => ({ letra: l, text: celda(fila, `op${l}`) })).filter((o) => o.text);
    const correcta = celda(fila, "correcta");
    if (!statement && opciones.length === 0 && !correcta) continue; // fila vacía
    if (/^ejemplo\s*:/i.test(statement)) continue; // filas de muestra de la plantilla
    const error = (mensaje: string) => errores.push({ fila: f, mensaje });

    if (statement.length < 3) {
      error("Falta el texto de la pregunta.");
      continue;
    }
    if (preguntas.length >= MAX_PREGUNTAS) {
      error(`Se admiten hasta ${MAX_PREGUNTAS} preguntas por archivo; esta y las siguientes no se cargan.`);
      break;
    }

    const tipoEscrito = celda(fila, "tipo");
    let type = tipoDesdeTexto(tipoEscrito);
    if (tipoEscrito && !type) {
      error(`No se reconoce el tipo «${tipoEscrito}». Usa: ${TIPOS_EXCEL.map((t) => t.etiqueta).join(", ")}.`);
      continue;
    }
    const letrasCorrectas = [...new Set(correcta.toUpperCase().split(/[\s,;y/]+/).filter((x) => LETRAS.includes(x)))];
    const esVF = verdaderoOFalso(correcta) !== null && opciones.length === 0;
    if (!type) type = opciones.length === 0 ? (esVF ? "TRUE_FALSE" : "OPEN_TEXT") : letrasCorrectas.length > 1 ? "MULTIPLE_CHOICE" : "SINGLE_CHOICE";

    const puntosTexto = celda(fila, "puntos");
    const puntos = puntosTexto ? Number(puntosTexto.replace(",", ".")) : 1;
    if (!Number.isInteger(puntos) || puntos < 1 || puntos > 100) {
      error("Los puntos deben ser un número entero entre 1 y 100.");
      continue;
    }

    const base = { fila: f, statement, score: puntos, explanation: celda(fila, "retro") };

    if (type === "OPEN_TEXT") {
      preguntas.push({ ...base, type, options: [], expectedAnswer: opciones.length === 0 ? correcta : "" });
      continue;
    }
    if (type === "TRUE_FALSE") {
      // Acepta «Verdadero/Falso» directo, o la letra si escribieron las dos opciones.
      let valor = verdaderoOFalso(correcta);
      if (valor === null && letrasCorrectas.length === 1 && opciones.length === 2) {
        valor = verdaderoOFalso(opciones.find((o) => o.letra === letrasCorrectas[0])?.text ?? "");
      }
      if (valor === null) {
        error("En verdadero o falso, la «Respuesta correcta» debe decir Verdadero o Falso.");
        continue;
      }
      preguntas.push({ ...base, type, expectedAnswer: "", options: [{ text: "Verdadero", isCorrect: valor }, { text: "Falso", isCorrect: !valor }] });
      continue;
    }

    if (opciones.length < 2) {
      error("Necesita al menos dos opciones (Opción A y Opción B).");
      continue;
    }
    if (letrasCorrectas.length === 0) {
      error("Falta la «Respuesta correcta»: escribe la letra de la opción (por ejemplo B).");
      continue;
    }
    const sinOpcion = letrasCorrectas.filter((l) => !opciones.some((o) => o.letra === l));
    if (sinOpcion.length) {
      error(`La respuesta correcta señala la opción ${sinOpcion.join(", ")}, que está vacía.`);
      continue;
    }
    if (type === "SINGLE_CHOICE" && letrasCorrectas.length > 1) {
      error("Es de única respuesta pero tiene varias correctas. Deja una, o cambia el tipo a «Varias respuestas».");
      continue;
    }
    preguntas.push({ ...base, type, expectedAnswer: "", options: opciones.map((o) => ({ text: o.text, isCorrect: letrasCorrectas.includes(o.letra) })) });
  }

  if (preguntas.length === 0 && errores.length === 0) errores.push({ fila: 0, mensaje: "El archivo no tiene preguntas. Escríbelas en la hoja «Preguntas», debajo de los títulos." });
  return { preguntas, errores };
}
