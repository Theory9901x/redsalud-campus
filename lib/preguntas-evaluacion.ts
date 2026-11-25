import { prisma } from "@/lib/prisma";
import { leerEvaluacionExcel, MAX_BYTES_EXCEL, type ErrorImportacion, type PreguntaImportada } from "@/lib/evaluacion-excel";
import { questionSchema } from "@/lib/validations/course";

/**
 * LO COMÚN DEL CONSTRUCTOR DE PREGUNTAS.
 *
 * El mismo constructor (escribir las preguntas en la página o cargarlas desde
 * Excel) arma la evaluación presaber/postsaber de una capacitación y las
 * evaluaciones de un curso (inducción, reinducción…). Cada pantalla resuelve
 * QUIÉN puede editar y a QUÉ cuestionario; lo que se hace con las preguntas
 * vive aquí, una sola vez.
 */

export type TipoPregunta = "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE" | "OPEN_TEXT";
export type DatosPregunta = {
  type: TipoPregunta;
  statement: string;
  score: number;
  explanation: string;
  expectedAnswer: string;
  options: { text: string; isCorrect: boolean }[];
};

function errorDeOpciones(type: TipoPregunta, options: { isCorrect: boolean }[]): string | null {
  if (type === "OPEN_TEXT") return null;
  const correctas = options.filter((o) => o.isCorrect).length;
  if (correctas === 0) return "Marca cuál es la respuesta correcta.";
  if (type === "TRUE_FALSE" && (options.length !== 2 || correctas !== 1)) return "Verdadero o falso lleva dos opciones y una sola correcta.";
  if (type === "SINGLE_CHOICE" && correctas !== 1) return "En única respuesta solo puede haber una opción correcta.";
  if (type === "MULTIPLE_CHOICE" && correctas < 2) return "En varias respuestas marca dos o más opciones correctas (o cambia a única respuesta).";
  return null;
}

function validar(datos: DatosPregunta) {
  const opciones = datos.type === "OPEN_TEXT" ? [] : datos.options.map((o) => ({ text: o.text.trim(), isCorrect: o.isCorrect })).filter((o) => o.text);
  const parsed = questionSchema.safeParse({ ...datos, options: opciones });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa la pregunta." } as const;
  const error = errorDeOpciones(parsed.data.type, parsed.data.options);
  return error ? ({ error } as const) : ({ error: null, data: parsed.data } as const);
}

/** Crea (preguntaId null) o actualiza una pregunta del cuestionario. */
export async function guardarPreguntaEnQuiz(quizId: string, preguntaId: string | null, datos: DatosPregunta): Promise<{ error: string | null }> {
  const v = validar(datos);
  if (v.error !== null) return { error: v.error };
  const d = v.data;
  const campos = { type: d.type, statement: d.statement, score: d.score, explanation: d.explanation || null, expectedAnswer: d.expectedAnswer || null };
  const opciones = d.options.map((o, i) => ({ text: o.text, isCorrect: o.isCorrect, sortOrder: i }));

  if (preguntaId) {
    const actual = await prisma.question.findFirst({ where: { id: preguntaId, quizId }, select: { id: true } });
    if (!actual) return { error: "Esa pregunta ya no pertenece a esta evaluación. Recarga la página." };
    await prisma.$transaction([
      prisma.questionOption.deleteMany({ where: { questionId: preguntaId } }),
      prisma.question.update({ where: { id: preguntaId }, data: { ...campos, options: { create: opciones } } }),
    ]);
  } else {
    // max+1, no count(): borrar una pregunta deja hueco y count() chocaría con el orden único.
    const max = await prisma.question.aggregate({ where: { quizId }, _max: { sortOrder: true } });
    await prisma.question.create({ data: { quizId, ...campos, sortOrder: (max._max.sortOrder ?? -1) + 1, options: { create: opciones } } });
  }
  return { error: null };
}

export type AnalisisExcel = { error: string | null; preguntas: PreguntaImportada[]; errores: ErrorImportacion[] };

/** Interpreta el Excel que viene en el formulario (campo «archivo»). No guarda nada. */
export async function analizarExcelDePreguntas(formData: FormData): Promise<AnalisisExcel> {
  const archivo = formData.get("archivo");
  const falla = (error: string): AnalisisExcel => ({ error, preguntas: [], errores: [] });
  if (!(archivo instanceof File) || archivo.size === 0) return falla("Elige el archivo de Excel.");
  if (archivo.size > MAX_BYTES_EXCEL) return falla("El archivo pesa más de 5 MB. Usa la plantilla, sin imágenes.");
  if (!/\.xlsx$/i.test(archivo.name)) return falla("El archivo debe ser de Excel (.xlsx), como la plantilla.");
  return { error: null, ...(await leerEvaluacionExcel(await archivo.arrayBuffer())) };
}

/**
 * Guarda en el cuestionario las preguntas válidas del Excel. Con
 * `modo=reemplazar` borra antes las actuales, solo si nadie lo ha presentado
 * (borrar una pregunta borra sus respuestas).
 */
export async function importarExcelEnQuiz(quizId: string, formData: FormData): Promise<{ error: string | null; agregadas: number; reemplazo: boolean }> {
  const reemplazar = formData.get("modo") === "reemplazar";
  const falla = (error: string) => ({ error, agregadas: 0, reemplazo: reemplazar });
  const r = await analizarExcelDePreguntas(formData);
  if (r.error) return falla(r.error);
  const validas = r.preguntas.flatMap((p) => {
    const v = validar(p);
    return v.error === null ? [v.data] : [];
  });
  if (validas.length === 0) return falla("El archivo no tiene preguntas válidas para cargar.");
  if (reemplazar && (await prisma.quizAttempt.count({ where: { quizId } })) > 0) {
    return falla("Esta evaluación ya fue presentada: no se pueden reemplazar las preguntas, solo agregar.");
  }

  await prisma.$transaction(async (tx) => {
    if (reemplazar) await tx.question.deleteMany({ where: { quizId } });
    const max = await tx.question.aggregate({ where: { quizId }, _max: { sortOrder: true } });
    let orden = (max._max.sortOrder ?? -1) + 1;
    for (const p of validas) {
      await tx.question.create({
        data: {
          quizId,
          type: p.type,
          statement: p.statement,
          score: p.score,
          explanation: p.explanation || null,
          expectedAnswer: p.expectedAnswer || null,
          sortOrder: orden++,
          options: { create: p.options.map((o, i) => ({ text: o.text, isCorrect: o.isCorrect, sortOrder: i })) },
        },
      });
    }
  });
  return { error: null, agregadas: validas.length, reemplazo: reemplazar };
}
