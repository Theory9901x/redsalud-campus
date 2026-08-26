"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTutorOrAdmin, requireSurveyAccess } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/audit";
import { generarCodigoEncuesta, generarSlug } from "@/lib/encuestas/consultas";
import { admiteClave, esTipoDeOpcion, leerConfig, type ConfigPregunta } from "@/lib/encuestas/tipos";
import type { SurveyAudience, SurveyQuestionType } from "@prisma/client";

/**
 * ACCIONES DEL CONSTRUCTOR de encuestas.
 *
 * Quién puede: el administrador siempre; un tutor, sobre las encuestas que
 * él emite o las de las jornadas de sus áreas (`puedeGestionarEncuesta`).
 * El estudiante nunca llega aquí: sus páginas no importan estas acciones y
 * cada una vuelve a verificar el rol de todos modos.
 */
async function puedeGestionarEncuesta(surveyId: string) {
  const sesion = await requireTutorOrAdmin();
  if (sesion.user.role === "ADMIN") return sesion;

  const encuesta = await prisma.survey.findUniqueOrThrow({
    where: { id: surveyId },
    select: { createdBy: true },
  });
  if (encuesta.createdBy === sesion.user.id) return sesion;

  // No es suya: vale también ser tutor del área de la jornada adscrita.
  await requireSurveyAccess(surveyId);
  return sesion;
}

// ---------------------------------------------------------------- encuesta

export type EstadoAccion = { error: string | null };

export async function crearEncuestaAction(_prev: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  const sesion = await requireTutorOrAdmin();

  const title = String(formData.get("title") ?? "").trim();
  if (title.length < 5) return { error: "Escribe un título de al menos 5 caracteres." };

  const description = String(formData.get("description") ?? "").trim() || null;
  const audience = (String(formData.get("audience") ?? "INTERNO") as SurveyAudience) ?? "INTERNO";
  const themeColor = String(formData.get("themeColor") ?? "").trim() || null;
  const trainingActivityId = String(formData.get("trainingActivityId") ?? "").trim() || null;
  const planElegido = String(formData.get("trainingPlanId") ?? "").trim() || null;
  const desdePlantilla = String(formData.get("plantillaId") ?? "").trim() || null;

  // Trazabilidad: la encuesta puede colgar de una capacitación concreta
  // (que define su plan, para que no queden en contradicción) o solo del
  // plan, cuando mide la satisfacción del plan completo.
  let trainingPlanId: string | null = null;
  if (trainingActivityId) {
    const actividad = await prisma.trainingActivity.findUnique({
      where: { id: trainingActivityId },
      select: { planId: true },
    });
    if (!actividad) return { error: "La capacitación elegida no existe." };
    trainingPlanId = actividad.planId;
  } else if (planElegido) {
    const plan = await prisma.trainingPlan.findUnique({ where: { id: planElegido }, select: { id: true } });
    if (!plan) return { error: "El plan elegido no existe." };
    trainingPlanId = plan.id;
  }

  const [code, slug] = [await generarCodigoEncuesta(), generarSlug()];

  const encuesta = await prisma.survey.create({
    data: {
      code,
      slug,
      title,
      description,
      audience,
      themeColor,
      trainingPlanId,
      trainingActivityId,
      createdBy: sesion.user.id,
      // Toda encuesta nace con un primer bloque: el constructor edita
      // bloques, no una encuesta vacía sin dónde poner la primera pregunta.
      pages: { create: { sortOrder: 1, title: "Bloque 1" } },
    },
    select: { id: true },
  });

  // Duplicar desde plantilla: se copian bloques y preguntas tal cual.
  if (desdePlantilla) {
    const plantilla = await prisma.survey.findUnique({
      where: { id: desdePlantilla },
      include: { pages: { orderBy: { sortOrder: "asc" }, include: { questions: { orderBy: { sortOrder: "asc" } } } } },
    });
    if (plantilla) {
      await prisma.surveyPage.deleteMany({ where: { surveyId: encuesta.id } });
      for (const pagina of plantilla.pages) {
        await prisma.surveyPage.create({
          data: {
            surveyId: encuesta.id,
            sortOrder: pagina.sortOrder,
            title: pagina.title,
            description: pagina.description,
            attachmentUrl: pagina.attachmentUrl,
            attachmentName: pagina.attachmentName,
            questions: {
              create: pagina.questions.map((q) => ({
                sortOrder: q.sortOrder,
                type: q.type,
                prompt: q.prompt,
                description: q.description,
                imageUrl: q.imageUrl,
                isRequired: q.isRequired,
                config: q.config ?? undefined,
              })),
            },
          },
        });
      }
    }
  }

  await registrarAuditoria({
    userId: sesion.user.id,
    action: "CREATE",
    entity: "Survey",
    entityId: encuesta.id,
    description: `Creó la encuesta «${title}» (${code})`,
  });

  redirect(`/encuestas/${encuesta.id}/constructor`);
}

export async function actualizarEncuestaAction(surveyId: string, datos: {
  title?: string;
  description?: string | null;
  themeColor?: string | null;
  estimatedMinutes?: number | null;
  thankYouMessage?: string | null;
  audience?: SurveyAudience;
  requireLogin?: boolean;
  allowMultipleResponses?: boolean;
  showScoreToRespondent?: boolean;
  trainingActivityId?: string | null;
  trainingPlanId?: string | null;
}): Promise<EstadoAccion> {
  await puedeGestionarEncuesta(surveyId);

  if (datos.title !== undefined && datos.title.trim().length < 5) {
    return { error: "El título debe tener al menos 5 caracteres." };
  }

  // Trazabilidad: capacitación concreta manda (define su plan); sin
  // capacitación, puede colgar solo del plan; sin ninguno, institucional.
  let planPatch = {};
  if (datos.trainingActivityId !== undefined || datos.trainingPlanId !== undefined) {
    if (datos.trainingActivityId) {
      const actividad = await prisma.trainingActivity.findUnique({
        where: { id: datos.trainingActivityId },
        select: { planId: true },
      });
      if (!actividad) return { error: "La capacitación elegida no existe." };
      planPatch = { trainingActivityId: datos.trainingActivityId, trainingPlanId: actividad.planId };
    } else if (datos.trainingPlanId) {
      const plan = await prisma.trainingPlan.findUnique({
        where: { id: datos.trainingPlanId },
        select: { id: true },
      });
      if (!plan) return { error: "El plan elegido no existe." };
      planPatch = { trainingActivityId: null, trainingPlanId: plan.id };
    } else {
      planPatch = { trainingActivityId: null, trainingPlanId: null };
    }
  }

  await prisma.survey.update({
    where: { id: surveyId },
    data: {
      ...(datos.title !== undefined ? { title: datos.title.trim() } : {}),
      ...(datos.description !== undefined ? { description: datos.description?.trim() || null } : {}),
      ...(datos.themeColor !== undefined ? { themeColor: datos.themeColor } : {}),
      ...(datos.estimatedMinutes !== undefined ? { estimatedMinutes: datos.estimatedMinutes } : {}),
      ...(datos.thankYouMessage !== undefined ? { thankYouMessage: datos.thankYouMessage?.trim() || null } : {}),
      ...(datos.audience !== undefined ? { audience: datos.audience } : {}),
      ...(datos.requireLogin !== undefined ? { requireLogin: datos.requireLogin } : {}),
      ...(datos.allowMultipleResponses !== undefined ? { allowMultipleResponses: datos.allowMultipleResponses } : {}),
      ...(datos.showScoreToRespondent !== undefined ? { showScoreToRespondent: datos.showScoreToRespondent } : {}),
      ...planPatch,
    },
  });

  revalidatePath(`/encuestas/${surveyId}/constructor`);
  return { error: null };
}

export async function cambiarEstadoEncuestaAction(
  surveyId: string,
  estado: "PUBLISHED" | "CLOSED" | "DRAFT"
): Promise<EstadoAccion> {
  const sesion = await puedeGestionarEncuesta(surveyId);

  if (estado === "PUBLISHED") {
    const preguntas = await prisma.surveyQuestion.count({ where: { page: { surveyId } } });
    if (preguntas === 0) return { error: "Agrega al menos una pregunta antes de publicar." };
  }

  await prisma.survey.update({
    where: { id: surveyId },
    data: {
      status: estado,
      ...(estado === "PUBLISHED" ? { publishedAt: new Date() } : {}),
      ...(estado === "CLOSED" ? { closedAt: new Date() } : {}),
    },
  });

  await registrarAuditoria({
    userId: sesion.user.id,
    action: "UPDATE",
    entity: "Survey",
    entityId: surveyId,
    description:
      estado === "PUBLISHED" ? "Publicó la encuesta" : estado === "CLOSED" ? "Cerró la encuesta" : "Devolvió la encuesta a borrador",
  });

  revalidatePath(`/encuestas/${surveyId}/constructor`);
  revalidatePath("/encuestas");
  return { error: null };
}

export async function eliminarEncuestaAction(surveyId: string): Promise<EstadoAccion> {
  const sesion = await puedeGestionarEncuesta(surveyId);

  const encuesta = await prisma.survey.findUniqueOrThrow({
    where: { id: surveyId },
    select: { title: true, code: true, _count: { select: { responses: true } } },
  });
  // Con respuestas dentro no se borra: se CIERRA. Borrar respuestas reales
  // por limpiar un listado es exactamente el accidente que hay que impedir.
  if (encuesta._count.responses > 0) {
    return { error: "Esta encuesta ya tiene respuestas: ciérrala en vez de eliminarla, para conservar la evidencia." };
  }

  await prisma.survey.delete({ where: { id: surveyId } });
  await registrarAuditoria({
    userId: sesion.user.id,
    action: "DELETE",
    entity: "Survey",
    entityId: surveyId,
    description: `Eliminó la encuesta «${encuesta.title}» (${encuesta.code}), sin respuestas`,
  });

  revalidatePath("/encuestas");
  redirect("/encuestas");
}

// ---------------------------------------------------------------- bloques

export async function crearBloqueAction(surveyId: string): Promise<EstadoAccion> {
  await puedeGestionarEncuesta(surveyId);
  const ultimo = await prisma.surveyPage.findFirst({
    where: { surveyId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  const orden = (ultimo?.sortOrder ?? 0) + 1;
  await prisma.surveyPage.create({ data: { surveyId, sortOrder: orden, title: `Bloque ${orden}` } });
  revalidatePath(`/encuestas/${surveyId}/constructor`);
  return { error: null };
}

export async function actualizarBloqueAction(
  surveyId: string,
  pageId: string,
  datos: { title?: string; description?: string | null; attachmentUrl?: string | null; attachmentName?: string | null }
): Promise<EstadoAccion> {
  await puedeGestionarEncuesta(surveyId);
  await prisma.surveyPage.update({
    where: { id: pageId },
    data: {
      ...(datos.title !== undefined ? { title: datos.title.trim() || "Bloque" } : {}),
      ...(datos.description !== undefined ? { description: datos.description?.trim() || null } : {}),
      ...(datos.attachmentUrl !== undefined ? { attachmentUrl: datos.attachmentUrl } : {}),
      ...(datos.attachmentName !== undefined ? { attachmentName: datos.attachmentName } : {}),
    },
  });
  revalidatePath(`/encuestas/${surveyId}/constructor`);
  return { error: null };
}

export async function eliminarBloqueAction(surveyId: string, pageId: string): Promise<EstadoAccion> {
  await puedeGestionarEncuesta(surveyId);
  const total = await prisma.surveyPage.count({ where: { surveyId } });
  if (total <= 1) return { error: "La encuesta necesita al menos un bloque." };
  await prisma.surveyPage.delete({ where: { id: pageId } });
  revalidatePath(`/encuestas/${surveyId}/constructor`);
  return { error: null };
}

// --------------------------------------------------------------- preguntas

export type DatosPregunta = {
  type: SurveyQuestionType;
  prompt: string;
  description?: string | null;
  imageUrl?: string | null;
  isRequired: boolean;
  config: ConfigPregunta;
};

function validarPregunta(datos: DatosPregunta): string | null {
  if (datos.prompt.trim().length < 5) return "Escribe el enunciado de la pregunta (mínimo 5 caracteres).";

  if (esTipoDeOpcion(datos.type) && datos.type !== "YES_NO") {
    const opciones = datos.config.opciones ?? [];
    if (opciones.length < 2) return "Una pregunta de opciones necesita al menos dos.";
    if (opciones.some((o) => !o.texto.trim())) return "Ninguna opción puede quedar vacía.";
  }
  if (datos.type === "SCALE") {
    const min = datos.config.escalaMin ?? 1;
    const max = datos.config.escalaMax ?? 5;
    if (min >= max) return "En la escala, el mínimo debe ser menor que el máximo.";
  }
  if (datos.type === "MATCHING") {
    if ((datos.config.opciones ?? []).length < 2 || (datos.config.grupos ?? []).length < 2) {
      return "Relacionar necesita al menos dos elementos y dos grupos.";
    }
  }
  if (datos.config.opcionCorrectaId) {
    if (!admiteClave(datos.type)) return "Solo las preguntas de una sola opción correcta admiten clave.";
    const ids = (datos.config.opciones ?? []).map((o) => o.id);
    const conYesNo = datos.type === "YES_NO" && ["si", "no"].includes(datos.config.opcionCorrectaId);
    if (!conYesNo && !ids.includes(datos.config.opcionCorrectaId)) {
      return "La opción marcada como correcta no está entre las opciones.";
    }
  }
  return null;
}

export async function crearPreguntaAction(
  surveyId: string,
  pageId: string,
  datos: DatosPregunta
): Promise<EstadoAccion> {
  await puedeGestionarEncuesta(surveyId);
  const problema = validarPregunta(datos);
  if (problema) return { error: problema };

  const ultima = await prisma.surveyQuestion.findFirst({
    where: { pageId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  await prisma.surveyQuestion.create({
    data: {
      pageId,
      sortOrder: (ultima?.sortOrder ?? 0) + 1,
      type: datos.type,
      prompt: datos.prompt.trim(),
      description: datos.description?.trim() || null,
      imageUrl: datos.imageUrl || null,
      isRequired: datos.isRequired,
      config: datos.config as object,
    },
  });

  revalidatePath(`/encuestas/${surveyId}/constructor`);
  return { error: null };
}

export async function actualizarPreguntaAction(
  surveyId: string,
  questionId: string,
  datos: DatosPregunta
): Promise<EstadoAccion> {
  await puedeGestionarEncuesta(surveyId);
  const problema = validarPregunta(datos);
  if (problema) return { error: problema };

  await prisma.surveyQuestion.update({
    where: { id: questionId },
    data: {
      type: datos.type,
      prompt: datos.prompt.trim(),
      description: datos.description?.trim() || null,
      imageUrl: datos.imageUrl || null,
      isRequired: datos.isRequired,
      config: datos.config as object,
    },
  });

  revalidatePath(`/encuestas/${surveyId}/constructor`);
  return { error: null };
}

export async function eliminarPreguntaAction(surveyId: string, questionId: string): Promise<EstadoAccion> {
  await puedeGestionarEncuesta(surveyId);
  await prisma.surveyQuestion.delete({ where: { id: questionId } });
  revalidatePath(`/encuestas/${surveyId}/constructor`);
  return { error: null };
}

export async function moverPreguntaAction(
  surveyId: string,
  questionId: string,
  direccion: "arriba" | "abajo"
): Promise<EstadoAccion> {
  await puedeGestionarEncuesta(surveyId);

  const pregunta = await prisma.surveyQuestion.findUniqueOrThrow({
    where: { id: questionId },
    select: { pageId: true, sortOrder: true },
  });
  const vecina = await prisma.surveyQuestion.findFirst({
    where: {
      pageId: pregunta.pageId,
      sortOrder: direccion === "arriba" ? { lt: pregunta.sortOrder } : { gt: pregunta.sortOrder },
    },
    orderBy: { sortOrder: direccion === "arriba" ? "desc" : "asc" },
    select: { id: true, sortOrder: true },
  });
  if (!vecina) return { error: null }; // ya está en el extremo

  // Intercambio en tres pasos por la restricción única (pageId, sortOrder).
  await prisma.$transaction([
    prisma.surveyQuestion.update({ where: { id: questionId }, data: { sortOrder: -1 } }),
    prisma.surveyQuestion.update({ where: { id: vecina.id }, data: { sortOrder: pregunta.sortOrder } }),
    prisma.surveyQuestion.update({ where: { id: questionId }, data: { sortOrder: vecina.sortOrder } }),
  ]);

  revalidatePath(`/encuestas/${surveyId}/constructor`);
  return { error: null };
}
