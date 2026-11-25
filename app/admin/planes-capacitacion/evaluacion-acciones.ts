"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/audit";
import { requireTrainingActivityAccess } from "@/lib/auth-helpers";
import { crearEvaluacionCapacitacion } from "@/lib/evaluacion-capacitacion";
import { analizarExcelDePreguntas, guardarPreguntaEnQuiz, importarExcelEnQuiz, type AnalisisExcel, type DatosPregunta } from "@/lib/preguntas-evaluacion";

/**
 * ACCIONES DEL CONSTRUCTOR DE LA EVALUACIÓN PRESABER / POSTSABER.
 *
 * Dos formas de armarla, las dos desde la pestaña «Evaluación» de la
 * capacitación: escribir las preguntas ahí mismo o cargar la plantilla de
 * Excel (analizar → importar). Ninguna pide «crear la evaluación» antes: se
 * crea sola con la primera pregunta. Lo que se hace con las preguntas es lo
 * mismo que en el constructor de cursos (lib/preguntas-evaluacion.ts).
 */

async function accesoParaEditar(activityId: string) {
  const { session, planId } = await requireTrainingActivityAccess(activityId);
  const plan = await prisma.trainingPlan.findUnique({ where: { id: planId }, select: { status: true } });
  const error = plan?.status === "CLOSED" ? "El plan está cerrado: la evaluación se puede consultar, pero no modificar." : null;
  return { session, planId, error };
}

function refrescar(basePath: string, planId: string, activityId: string) {
  for (const base of new Set([basePath, "/admin/planes-capacitacion", "/tutor/planes-capacitacion", "/tutor/capacitaciones"])) {
    revalidatePath(`${base}/${planId}/actividades/${activityId}`);
  }
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
  // La evaluación nace con la primera pregunta: no hay paso previo de «crear».
  const quizId = await crearEvaluacionCapacitacion(activityId, session.user.id);
  const r = await guardarPreguntaEnQuiz(quizId, preguntaId, datos);
  if (!r.error) refrescar(basePath, planId, activityId);
  return r;
}

/** Paso 1 de la carga: interpreta el Excel y devuelve qué se cargaría. No guarda nada. */
export async function analizarExcelEvaluacionAction(activityId: string, formData: FormData): Promise<AnalisisExcel> {
  await requireTrainingActivityAccess(activityId);
  return analizarExcelDePreguntas(formData);
}

/** Paso 2: guarda las preguntas del Excel (agregando o reemplazando). */
export async function importarExcelEvaluacionAction(
  basePath: string,
  activityId: string,
  formData: FormData
): Promise<{ error: string | null; agregadas: number }> {
  const { session, planId, error } = await accesoParaEditar(activityId);
  if (error) return { error, agregadas: 0 };
  const quizId = await crearEvaluacionCapacitacion(activityId, session.user.id);
  const r = await importarExcelEnQuiz(quizId, formData);
  if (r.error) return { error: r.error, agregadas: 0 };
  await registrarAuditoria({
    userId: session.user.id,
    action: "UPDATE",
    entity: "TrainingActivity",
    entityId: activityId,
    description: `Cargó ${r.agregadas} pregunta(s) de la evaluación presaber/postsaber desde Excel${r.reemplazo ? " (reemplazando las anteriores)" : ""}.`,
  });
  refrescar(basePath, planId, activityId);
  return { error: null, agregadas: r.agregadas };
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
