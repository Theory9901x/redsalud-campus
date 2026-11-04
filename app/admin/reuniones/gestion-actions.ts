"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireReunionAccess } from "@/lib/reuniones-access";
import { getSesionReunion } from "@/lib/reuniones";
import { edicionSesionReunion } from "@/lib/reuniones-edicion";
import { registrarAuditoria } from "@/lib/audit";
import { saveTrainingActivityDocument, fichaDesdeFormulario } from "@/lib/storage";
import type { EstadoReunion } from "./actions";

function refrescar(planId: string, activityId: string) {
  for (const base of ["/admin/reuniones", "/tutor/reuniones"]) {
    revalidatePath(base); revalidatePath(`${base}/${planId}`); revalidatePath(`${base}/${planId}/sesiones/${activityId}`);
  }
}

export async function editarDatosReunionAction(planId: string, activityId: string, fd: FormData): Promise<EstadoReunion> {
  const user = await requireReunionAccess(planId, activityId, true);
  const d = await getSesionReunion(planId, activityId);
  if (!d?.jornada) return { error: "La sesión no existe." };
  const parsed = edicionSesionReunion.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  const data = parsed.data;
  const areaActual = d.areaId ?? (await prisma.trainingArea.findFirst({ where: { tutorId: d.anfitrionId, isActive: true }, select: { id: true } }))?.id ?? "";
  if (!d.puedeEditarReunion && (data.reunion !== d.reunion.titulo || data.anfitrionAreaId !== areaActual)) return { error: "Solo quien creó la reunión puede cambiar su nombre general o el área anfitriona." };
  const area = await prisma.trainingArea.findFirst({ where: { id: data.anfitrionAreaId, isActive: true, tutor: { status: "ACTIVE", role: { in: ["ADMIN", "TUTOR"] } } }, select: { id: true, tutorId: true } });
  if (!area?.tutorId) return { error: "Selecciona un área anfitriona activa." };
  const startsAt = new Date(`${data.fecha}T${data.inicio}:00-05:00`);
  const endsAt = data.fin ? new Date(`${data.fecha}T${data.fin}:00-05:00`) : null;
  const saved = await prisma.$transaction(async tx => {
    // El acta se puede corregir siempre, también con la reunión cerrada.
    const result = await tx.trainingActivity.updateMany({ where: { id: activityId, planId }, data: {
      title: data.titulo, objective: data.objetivo, meetingAgenda: data.ordenDelDia, responsibleLabel: data.responsable, responsibleUserId: area.tutorId, areaId: area.id,
      targetAudienceNote: data.dirigidoA || null, modality: data.modalidad, startDate: startsAt, endDate: endsAt,
    } });
    if (!result.count) return false;
    if (d.puedeEditarReunion && data.reunion !== d.reunion.titulo) await tx.trainingPlan.update({ where: { id: planId }, data: { title: data.reunion } });
    await tx.trainingSession.update({ where: { id: d.jornada!.id }, data: { startsAt, endsAt, audience: data.audience, modality: data.modalidad, location: data.lugar || null, facilitador: data.responsable } });
    return true;
  });
  if (!saved) return { error: "La sesión no existe. Vuelve a cargar los datos." };
  await registrarAuditoria({ userId: user.user.id, action: "UPDATE", entity: "TrainingActivity", entityId: activityId, description: "Datos y horario de la reunión actualizados; enlaces y asistencia conservados." }).catch(() => {});
  refrescar(planId, activityId);
  return { error: null, ok: true };
}

/** Cada compromiso es un ítem único: un doble envío o dos anfitriones escribiendo lo mismo no lo repiten. */
const normal = (t: string) => t.replace(/\s+/g, " ").trim().toLowerCase();

export async function gestionarCompromisoReunionAction(planId: string, activityId: string, fd: FormData): Promise<EstadoReunion> {
  const user = await requireReunionAccess(planId, activityId, true);
  const texto = String(fd.get("texto") ?? "").trim();
  const operacion = String(fd.get("operacion"));
  if (!["agregar", "editar", "eliminar"].includes(operacion)) return { error: "Operación no válida." };
  if (operacion !== "eliminar" && !texto) return { error: "Escribe el compromiso que quieres guardar." };
  if (texto.length > 10000) return { error: "El compromiso es demasiado largo; divídelo en varios puntos." };
  let guardado;
  if (operacion === "agregar") {
    const actual = await prisma.trainingActivity.findFirst({ where: { id: activityId, planId }, select: { followUpEvidence: true } });
    if (actual?.followUpEvidence.some(c => normal(c) === normal(texto))) return { error: "Ese compromiso ya está en el acta." };
    guardado = await prisma.trainingActivity.updateMany({ where: { id: activityId, planId }, data: { followUpEvidence: { push: texto } } });
  } else {
    let originales: unknown;
    try { originales = JSON.parse(String(fd.get("originales"))); } catch { return { error: "Actualiza la lista de compromisos antes de editar." }; }
    const indice = Number(fd.get("indice"));
    if (!Array.isArray(originales) || !originales.every(x => typeof x === "string") || !Number.isInteger(indice) || indice < 0 || indice >= originales.length) return { error: "El compromiso no es válido." };
    const lista = [...originales] as string[];
    if (operacion === "editar" && lista.some((c, i) => i !== indice && normal(c) === normal(texto))) return { error: "Ese compromiso ya está en el acta." };
    if (operacion === "editar") lista[indice] = texto; else lista.splice(indice, 1);
    guardado = await prisma.trainingActivity.updateMany({ where: { id: activityId, planId, followUpEvidence: { equals: originales as string[] } }, data: { followUpEvidence: lista } });
  }
  if (!guardado.count) return { error: "La lista de compromisos cambió. Actualiza la lista antes de continuar." };
  await registrarAuditoria({ userId: user.user.id, action: "UPDATE", entity: "TrainingActivity", entityId: activityId, description: `Compromiso de la reunión: ${operacion}` }).catch(() => {});
  refrescar(planId, activityId);
  return { error: null, ok: true };
}

export async function adjuntarDocumentoReunionAction(planId: string, activityId: string, fd: FormData): Promise<EstadoReunion> {
  const user = await requireReunionAccess(planId, activityId, true);
  const file = fd.get("file");
  if (!(file instanceof File) || !file.size) return { error: "Selecciona el documento que quieres adjuntar." };
  if (file.size > 15 * 1024 * 1024) return { error: "El archivo debe pesar hasta 15 MB." };
  if (!/\.(pdf|docx?|xlsx?|pptx?|png|jpe?g|webp|txt|csv)$/i.test(file.name)) return { error: "Adjunta un PDF, documento de Office, imagen, texto o CSV." };
  await saveTrainingActivityDocument(file, activityId, user.user.id, fichaDesdeFormulario(fd));
  await registrarAuditoria({ userId: user.user.id, action: "UPDATE", entity: "TrainingActivity", entityId: activityId, description: `Documento de reunión adjuntado: ${file.name}` }).catch(() => {});
  refrescar(planId, activityId);
  return { error: null, ok: true };
}

export async function guardarDesarrolloReunionAction(planId: string, activityId: string, fd: FormData): Promise<EstadoReunion> {
  const user = await requireReunionAccess(planId, activityId, true);
  const saved = await prisma.trainingActivity.updateMany({ where: { id: activityId, planId }, data: { methodology: String(fd.get("desarrollo") ?? "").trim() || null } });
  if (!saved.count) return { error: "La sesión no existe." };
  await registrarAuditoria({ userId: user.user.id, action: "UPDATE", entity: "TrainingActivity", entityId: activityId, description: "Desarrollo de la reunión guardado desde la sala." }).catch(() => {});
  refrescar(planId, activityId);
  return { error: null, ok: true };
}

/**
 * El ACTA completa en un solo guardado: objetivo, orden del día, responsable
 * y desarrollo. Se puede corregir siempre, también con la reunión cerrada.
 * Los compromisos tienen su propia lista.
 */
export async function guardarActaReunionAction(planId: string, activityId: string, fd: FormData): Promise<EstadoReunion> {
  const user = await requireReunionAccess(planId, activityId, true);
  const texto = (k: string, max: number) => String(fd.get(k) ?? "").trim().slice(0, max);
  const responsable = texto("responsable", 200);
  if (!responsable) return { error: "Escribe el responsable como figura en el acta." };
  const saved = await prisma.trainingActivity.updateMany({
    where: { id: activityId, planId },
    data: {
      objective: texto("objetivo", 5000) || null,
      meetingAgenda: texto("ordenDelDia", 10000) || null,
      responsibleLabel: responsable,
      methodology: texto("desarrollo", 50000) || null,
    },
  });
  if (!saved.count) return { error: "La sesión no existe." };
  await registrarAuditoria({ userId: user.user.id, action: "UPDATE", entity: "TrainingActivity", entityId: activityId, description: "Acta de la reunión editada (objetivo, orden del día, responsable y desarrollo)." }).catch(() => {});
  refrescar(planId, activityId);
  return { error: null, ok: true };
}
