"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/audit";
import { requireTrainingActivityAccess } from "@/lib/auth-helpers";
import { crearEvaluacionCapacitacion } from "@/lib/evaluacion-capacitacion";
import { leerEvaluacionExcel, MAX_BYTES_EXCEL, type ErrorImportacion, type PreguntaImportada } from "@/lib/evaluacion-excel";
import { questionSchema } from "@/lib/validations/course";

/**
 * ACCIONES DEL CONSTRUCTOR DE LA EVALUACIÓN PRESABER / POSTSABER.
 *
 * Dos formas de armarla, las dos desde la pestaña «Evaluación» de la
 * capacitación: escribir las preguntas ahí mismo (guardarPreguntaAction) o
 * cargar la plantilla de Excel (analizar → importar). Ninguna pide «crear la
 * evaluación» antes: se crea sola con la primera pregunta.
 */

type Tipo = "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE" | "OPEN_TEXT";
export type DatosPregunta = {
  type: Tipo;
  statement: string;
  score: number;
  explanation: string;
  expectedAnswer: string;
  options: { text: string; isCorrect: boolean }[];
};

async function accesoParaEditar(activityId: string) {
  const { session, planId } = await requireTrainingActivityAccess(activityId);
  const plan = await prisma.trainingPlan.findUnique({ where: { id: planId }, select: { status: true } });
  const error = plan?.status === "CLOSED" ? "El plan está cerrado: la evaluación se puede consultar, pero no modificar." : null;
  return { session, planId, error };
}

function errorDeOpciones(type: Tipo, options: { isCorrect: boolean }[]): string | null {
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

function refrescar(basePath: string, planId: string, activityId: string) {
  for (const base of new Set([basePath, "/admin/planes-capacitacion", "/tutor/planes-capacitacion", "/tutor/capacitaciones"])) {
    revalidatePath(`${base}/${planId}/actividades/${activityId}`);
  }
  revalidatePath("/admin/evaluaciones");
  revalidatePath("/tutor/evaluaciones");
}

/** Crea o actualiza UNA pregunta desde el constructor en línea. */
export async function guardarPreguntaAction(
  basePath: string,
  activityId: string,
  preguntaId: string | null,
  datos: DatosPregunta
): Promise<{ error: string | null }> {
  const { session, planId, error } = await accesoParaEditar(activityId);
  if (error) return { error };
  const v = validar(datos);
  if (v.error !== null) return { error: v.error };
  const d = v.data;

  // La evaluación nace con la primera pregunta: no hay paso previo de «crear».
  const quizId = await crearEvaluacionCapacitacion(activityId, session.user.id);
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
    const max = await prisma.question.aggregate({ where: { quizId }, _max: { sortOrder: true } });
    await prisma.question.create({ data: { quizId, ...campos, sortOrder: (max._max.sortOrder ?? -1) + 1, options: { create: opciones } } });
  }
  refrescar(basePath, planId, activityId);
  return { error: null };
}

async function leerArchivo(formData: FormData): Promise<{ error: string } | { preguntas: PreguntaImportada[]; errores: ErrorImportacion[] }> {
  const archivo = formData.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) return { error: "Elige el archivo de Excel." };
  if (archivo.size > MAX_BYTES_EXCEL) return { error: "El archivo pesa más de 5 MB. Usa la plantilla, sin imágenes." };
  if (!/\.xlsx$/i.test(archivo.name)) return { error: "El archivo debe ser de Excel (.xlsx), como la plantilla." };
  return leerEvaluacionExcel(await archivo.arrayBuffer());
}

/** Paso 1 de la carga: interpreta el Excel y devuelve qué se cargaría. No guarda nada. */
export async function analizarExcelEvaluacionAction(
  activityId: string,
  formData: FormData
): Promise<{ error: string | null; preguntas: PreguntaImportada[]; errores: ErrorImportacion[] }> {
  await requireTrainingActivityAccess(activityId);
  const r = await leerArchivo(formData);
  if ("error" in r) return { error: r.error, preguntas: [], errores: [] };
  return { error: null, ...r };
}

/**
 * Paso 2: guarda las preguntas del Excel. `modo` = "agregar" (se suman a las
 * que haya) o "reemplazar" (borra las actuales; solo si nadie la ha
 * presentado, porque borrar una pregunta borra sus respuestas).
 */
export async function importarExcelEvaluacionAction(
  basePath: string,
  activityId: string,
  formData: FormData
): Promise<{ error: string | null; agregadas: number }> {
  const { session, planId, error } = await accesoParaEditar(activityId);
  if (error) return { error, agregadas: 0 };
  const r = await leerArchivo(formData);
  if ("error" in r) return { error: r.error, agregadas: 0 };

  const validas = r.preguntas.flatMap((p) => {
    const v = validar(p);
    return v.error === null ? [v.data] : [];
  });
  if (validas.length === 0) return { error: "El archivo no tiene preguntas válidas para cargar.", agregadas: 0 };

  const quizId = await crearEvaluacionCapacitacion(activityId, session.user.id);
  const reemplazar = formData.get("modo") === "reemplazar";
  if (reemplazar) {
    const intentos = await prisma.quizAttempt.count({ where: { quizId } });
    if (intentos > 0) return { error: "Esta evaluación ya fue presentada: no se pueden reemplazar las preguntas, solo agregar.", agregadas: 0 };
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

  await registrarAuditoria({
    userId: session.user.id,
    action: "UPDATE",
    entity: "TrainingActivity",
    entityId: activityId,
    description: `Cargó ${validas.length} pregunta(s) de la evaluación presaber/postsaber desde Excel${reemplazar ? " (reemplazando las anteriores)" : ""}.`,
  });
  refrescar(basePath, planId, activityId);
  return { error: null, agregadas: validas.length };
}

export type EstadoDatosCapacitacion = { error: string | null; success?: boolean };

/**
 * Edita los datos básicos de una capacitación desde su propia página: nombre,
 * trimestres, a quién va dirigida, modalidad, área, si es obligatoria y el
 * objetivo. El curso que le da contenido (o su contenedor interno) conserva
 * el mismo nombre, que es el que la persona ve al presentar la evaluación.
 */
export async function actualizarDatosCapacitacionAction(
  basePath: string,
  activityId: string,
  _prev: EstadoDatosCapacitacion,
  formData: FormData
): Promise<EstadoDatosCapacitacion> {
  const { session, planId, error } = await accesoParaEditar(activityId);
  if (error) return { error };
  const actual = await prisma.trainingActivity.findUniqueOrThrow({
    where: { id: activityId },
    select: { title: true, status: true, startDate: true, courseId: true, plan: { select: { isIndependent: true, kind: true } }, course: { select: { title: true } } },
  });
  if (actual.plan.kind !== "CAPACITACION") return { error: "Esto solo aplica a capacitaciones." };
  if (actual.status === "CLOSED") return { error: "La capacitación está cerrada: reábrela para editarla." };

  const title = String(formData.get("title") ?? "").trim().replace(/\s+/g, " ").slice(0, 300);
  if (title.length < 3) return { error: "Escribe el nombre de la capacitación." };
  const targetAudience = String(formData.get("targetAudience"));
  const modality = String(formData.get("modality"));
  if (!["ADMINISTRATIVO", "ASISTENCIAL", "AMBOS"].includes(targetAudience)) return { error: "Elige a quién va dirigida." };
  if (!["VIRTUAL", "PRESENCIAL", "MIXTA"].includes(modality)) return { error: "Elige la modalidad." };
  const delPlan = !actual.plan.isIndependent;
  const quarters = [...new Set(formData.getAll("quarters").map(Number).filter((t) => [1, 2, 3, 4].includes(t)))].sort();
  if (delPlan && quarters.length === 0 && !actual.startDate) return { error: "Marca al menos un trimestre." };
  const areaId = String(formData.get("areaId") ?? "") || null;
  if (delPlan && areaId && !(await prisma.trainingArea.findUnique({ where: { id: areaId }, select: { id: true } }))) return { error: "El área elegida no existe." };
  const objective = String(formData.get("objective") ?? "").trim().slice(0, 2000) || null;

  await prisma.trainingActivity.update({
    where: { id: activityId },
    data: {
      title,
      targetAudience: targetAudience as "ADMINISTRATIVO" | "ASISTENCIAL" | "AMBOS",
      modality: modality as "VIRTUAL" | "PRESENCIAL" | "MIXTA",
      isRequired: formData.get("isRequired") === "on",
      objective,
      ...(delPlan ? { quarters, areaId } : {}),
    },
  });
  // El curso llevaba el nombre de la capacitación: lo sigue llevando.
  if (actual.courseId && actual.course?.title === actual.title && title !== actual.title) {
    await prisma.course.update({ where: { id: actual.courseId }, data: { title } });
  }
  await registrarAuditoria({
    userId: session.user.id,
    action: "UPDATE",
    entity: "TrainingActivity",
    entityId: activityId,
    description: `Editó los datos de la capacitación «${title}»${title !== actual.title ? ` (antes «${actual.title}»)` : ""}.`,
  });
  refrescar(basePath, planId, activityId);
  revalidatePath(`${basePath}/${planId}`);
  return { error: null, success: true };
}
