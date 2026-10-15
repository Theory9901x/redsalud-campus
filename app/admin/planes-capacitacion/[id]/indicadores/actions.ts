"use server";

import { revalidatePath } from "next/cache";
import type { PlanMejoraEstado } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireTrainingPlanRead } from "@/lib/auth-helpers";
import { esSoloLectura, veComoAdmin } from "@/lib/roles";
import { registrarAuditoria } from "@/lib/audit";
import { nombreIndicador } from "@/lib/indicadores-gestion";
import { esCodigo, type CodigoIndicador } from "@/components/indicadores/catalogo";

/**
 * ACCIONES de la gestión de indicadores: análisis por periodo y planes de
 * mejora. Las comparten la ruta del admin y la del tutor.
 *
 * Alcance: quien ve el plan completo (admin o responsable del plan) puede
 * escribir en lo institucional y en cualquier área; el tutor de un área solo
 * en la suya. SEGUIMIENTO no escribe nunca (el proxy ya lo corta; aquí se
 * repite el candado por si algún día cambia el proxy).
 */

export type EstadoAccion = { error: string | null; ok?: boolean };

type Alcance = { userId: string; institucional: boolean };

/** Quién es y hasta dónde llega. Lanza si no puede ni ver el plan. */
async function alcanceDe(planId: string): Promise<Alcance> {
  const session = await requireTrainingPlanRead(planId);
  if (esSoloLectura(session.user.role)) throw new Error("El rol de seguimiento es de solo consulta.");
  const plan = await prisma.trainingPlan.findUnique({ where: { id: planId }, select: { tutorId: true } });
  if (!plan) throw new Error("Plan no encontrado.");
  return { userId: session.user.id, institucional: veComoAdmin(session.user.role) || plan.tutorId === session.user.id };
}

/** El área sobre la que se quiere escribir: null = institucional (solo quien ve todo). */
async function verificarArea(alcance: Alcance, areaId: string | null) {
  if (alcance.institucional) return;
  if (!areaId) throw new Error("Un tutor de área escribe sobre su área, no sobre lo institucional.");
  const area = await prisma.trainingArea.findUnique({ where: { id: areaId }, select: { tutorId: true } });
  if (!area || area.tutorId !== alcance.userId) throw new Error("Esa área no te corresponde.");
}

function revalidar(planId: string, codigo: string) {
  for (const base of ["/admin/planes-capacitacion", "/tutor/planes-capacitacion"]) {
    revalidatePath(`${base}/${planId}/indicadores`);
    revalidatePath(`${base}/${planId}/indicadores/${codigo}`);
  }
}

const texto = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const opcional = (fd: FormData, k: string) => texto(fd, k) || null;
const mensaje = (e: unknown) => (e instanceof Error ? e.message : "No se pudo completar la acción.");

function leerCodigo(x: string): CodigoIndicador {
  if (!esCodigo(x)) throw new Error("Indicador desconocido.");
  return x;
}

function leerTrimestre(x: string | null): number | null {
  if (!x) return null;
  const t = Number(x);
  if (!Number.isInteger(t) || t < 1 || t > 4) throw new Error("Trimestre inválido.");
  return t;
}

/**
 * ANÁLISIS del periodo: una sola fila por (plan, indicador, año, trimestre,
 * área), que se crea o se reescribe. Se busca con findFirst porque el índice
 * único incluye un nullable y Prisma no lo acepta en `where` único.
 */
export async function guardarAnalisisAction(_prev: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  try {
    const planId = texto(formData, "planId");
    const codigo = leerCodigo(texto(formData, "codigo"));
    const anio = Number(texto(formData, "anio"));
    const trimestre = leerTrimestre(texto(formData, "trimestre"));
    const areaId = opcional(formData, "areaId");
    const cuerpo = texto(formData, "texto");
    if (!trimestre) return { error: "Elige el trimestre que analizas." };
    if (cuerpo.length < 20) return { error: "El análisis debe tener al menos 20 caracteres: explica el resultado, no solo lo repitas." };
    if (!Number.isInteger(anio)) return { error: "Vigencia inválida." };

    const alcance = await alcanceDe(planId);
    await verificarArea(alcance, areaId);

    const existente = await prisma.indicadorAnalisis.findFirst({ where: { planId, codigo, anio, trimestre, areaId }, select: { id: true } });
    const fila = existente
      ? await prisma.indicadorAnalisis.update({ where: { id: existente.id }, data: { texto: cuerpo, autorId: alcance.userId } })
      : await prisma.indicadorAnalisis.create({ data: { planId, codigo, anio, trimestre, areaId, texto: cuerpo, autorId: alcance.userId } });

    await registrarAuditoria({
      userId: alcance.userId,
      action: existente ? "UPDATE" : "CREATE",
      entity: "TrainingPlan",
      entityId: planId,
      description: `Análisis ${codigo} (${nombreIndicador(codigo)}) · T${trimestre} ${anio}${areaId ? ` · área ${areaId}` : " · institucional"} · registro ${fila.id}`,
    });
    revalidar(planId, codigo);
    return { error: null, ok: true };
  } catch (e) {
    return { error: mensaje(e) };
  }
}

/** PLAN DE MEJORA nuevo, asignado a vigencia/trimestre, área, capacitación y responsable. */
export async function crearPlanMejoraAction(_prev: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  try {
    const planId = texto(formData, "planId");
    const codigo = leerCodigo(texto(formData, "codigo"));
    const anio = Number(texto(formData, "anio"));
    const trimestre = leerTrimestre(opcional(formData, "trimestre"));
    const areaId = opcional(formData, "areaId");
    const activityId = opcional(formData, "activityId");
    const titulo = texto(formData, "titulo");
    const hallazgo = texto(formData, "hallazgo");
    const acciones = texto(formData, "acciones");
    const responsableUserId = opcional(formData, "responsableUserId");
    const responsableLabel = opcional(formData, "responsableLabel");
    const fecha = texto(formData, "fechaCompromiso");

    if (!Number.isInteger(anio)) return { error: "Vigencia inválida." };
    if (titulo.length < 5) return { error: "Ponle un título al plan de mejora (mínimo 5 caracteres)." };
    if (hallazgo.length < 10) return { error: "Describe el hallazgo: qué midió el indicador y por qué preocupa." };
    if (acciones.length < 10) return { error: "Describe las acciones comprometidas." };
    if (!responsableUserId && !responsableLabel) return { error: "Asigna un responsable: una persona de la plataforma o un cargo." };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { error: "Indica la fecha de compromiso." };
    const fechaCompromiso = new Date(`${fecha}T12:00:00-05:00`);

    const alcance = await alcanceDe(planId);
    await verificarArea(alcance, areaId);

    if (activityId) {
      const act = await prisma.trainingActivity.findUnique({ where: { id: activityId }, select: { planId: true, areaId: true } });
      if (!act || act.planId !== planId) return { error: "La capacitación elegida no pertenece a este plan." };
      if (areaId && act.areaId && act.areaId !== areaId) return { error: "La capacitación elegida no es del área seleccionada." };
    }

    const creado = await prisma.planMejora.create({
      data: {
        planId,
        codigo,
        anio,
        trimestre,
        areaId,
        activityId,
        titulo,
        hallazgo,
        acciones,
        responsableUserId,
        responsableLabel: responsableUserId ? null : responsableLabel,
        fechaCompromiso,
        creadoPorId: alcance.userId,
      },
    });

    await registrarAuditoria({
      userId: alcance.userId,
      action: "CREATE",
      entity: "TrainingPlan",
      entityId: planId,
      description: `Plan de mejora «${titulo}» para ${codigo}${trimestre ? ` · T${trimestre}` : ""} ${anio}${areaId ? ` · área ${areaId}` : " · institucional"} · registro ${creado.id}`,
    });
    revalidar(planId, codigo);
    return { error: null, ok: true };
  } catch (e) {
    return { error: mensaje(e) };
  }
}

async function planMejoraConAlcance(planMejoraId: string) {
  const pm = await prisma.planMejora.findUnique({ where: { id: planMejoraId }, select: { id: true, planId: true, codigo: true, areaId: true, estado: true, titulo: true } });
  if (!pm) throw new Error("Plan de mejora no encontrado.");
  const alcance = await alcanceDe(pm.planId);
  await verificarArea(alcance, pm.areaId);
  return { pm, alcance };
}

/** SEGUIMIENTO: una entrada en la bitácora con el avance acumulado declarado. */
export async function agregarSeguimientoAction(_prev: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  try {
    const planMejoraId = texto(formData, "planMejoraId");
    const cuerpo = texto(formData, "texto");
    const avance = Number(texto(formData, "avance") || "0");
    if (cuerpo.length < 5) return { error: "Escribe qué se avanzó." };
    if (!Number.isInteger(avance) || avance < 0 || avance > 100) return { error: "El avance va de 0 a 100." };

    const { pm, alcance } = await planMejoraConAlcance(planMejoraId);
    if (pm.estado === "CERRADO") return { error: "El plan de mejora ya está cerrado." };

    await prisma.$transaction([
      prisma.planMejoraSeguimiento.create({ data: { planMejoraId, texto: cuerpo, avance, autorId: alcance.userId } }),
      // El primer seguimiento pasa el plan de ABIERTO a EN_CURSO: ya alguien está trabajando en él.
      ...(pm.estado === "ABIERTO" ? [prisma.planMejora.update({ where: { id: planMejoraId }, data: { estado: "EN_CURSO" } })] : []),
    ]);

    await registrarAuditoria({
      userId: alcance.userId,
      action: "UPDATE",
      entity: "TrainingPlan",
      entityId: pm.planId,
      description: `Seguimiento (${avance} %) al plan de mejora «${pm.titulo}» · ${pm.codigo} · registro ${pm.id}`,
    });
    revalidar(pm.planId, pm.codigo);
    return { error: null, ok: true };
  } catch (e) {
    return { error: mensaje(e) };
  }
}

/** Cambio de estado: cerrar exige el texto de cierre; reabrir lo conserva como historial. */
export async function cambiarEstadoPlanMejoraAction(_prev: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  try {
    const planMejoraId = texto(formData, "planMejoraId");
    const estado = texto(formData, "estado") as PlanMejoraEstado;
    const cierreTexto = opcional(formData, "cierreTexto");
    if (!["ABIERTO", "EN_CURSO", "CERRADO"].includes(estado)) return { error: "Estado inválido." };
    if (estado === "CERRADO" && (!cierreTexto || cierreTexto.length < 10)) return { error: "Para cerrar, describe el resultado o la evidencia del cierre." };

    const { pm, alcance } = await planMejoraConAlcance(planMejoraId);
    await prisma.planMejora.update({
      where: { id: planMejoraId },
      data: estado === "CERRADO" ? { estado, cierreTexto, cerradoAt: new Date() } : { estado, cerradoAt: null },
    });

    await registrarAuditoria({
      userId: alcance.userId,
      action: "UPDATE",
      entity: "TrainingPlan",
      entityId: pm.planId,
      description: `Plan de mejora «${pm.titulo}» → ${estado} · ${pm.codigo} · registro ${pm.id}`,
    });
    revalidar(pm.planId, pm.codigo);
    return { error: null, ok: true };
  } catch (e) {
    return { error: mensaje(e) };
  }
}
