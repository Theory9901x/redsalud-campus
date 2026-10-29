"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { accesoReuniones, requireReunionAccess } from "@/lib/reuniones-access";
import { saveTrainingActivityDocument, fichaDesdeFormulario } from "@/lib/storage";
import { registrarAuditoria } from "@/lib/audit";

/**
 * Acciones del módulo de REUNIONES ABIERTAS. Ver lib/reuniones.ts para el
 * modelo (reunión = plan REUNION, sesión = actividad + jornada).
 */
const BASE = "/admin/reuniones";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export type EstadoReunion = { error: string | null; ok?: boolean };

type SesionEntrada = { fecha: string; inicio: string; fin: string; dirigidoA: string; audience: string };

const texto = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

/** Las horas se interpretan en hora de Colombia: el servidor corre en UTC. */
const enBogota = (fecha: string, hora: string) => new Date(`${fecha}T${hora}:00-05:00`);

function leerSesiones(fd: FormData): SesionEntrada[] | string {
  let crudas: unknown;
  try {
    crudas = JSON.parse(texto(fd, "sesiones") || "[]");
  } catch {
    return "No se pudieron leer las sesiones.";
  }
  if (!Array.isArray(crudas) || crudas.length === 0) return "Agrega al menos una sesión con fecha y hora.";
  const sesiones: SesionEntrada[] = [];
  for (const [i, c] of crudas.entries()) {
    const s = c as Partial<SesionEntrada>;
    if (!s.fecha || !s.inicio) return `La sesión ${i + 1} necesita fecha y hora de inicio.`;
    if (s.fin && s.fin <= s.inicio) return `En la sesión ${i + 1} la hora de fin debe ser posterior a la de inicio.`;
    if (s.audience && !["INTERNAL", "EXTERNAL", "BOTH"].includes(s.audience)) return "Selecciona internos, externos o ambos.";
    sesiones.push({ audience: s.audience ?? "BOTH", fecha: s.fecha, inicio: s.inicio, fin: s.fin ?? "", dirigidoA: (s.dirigidoA ?? "").trim() });
  }
  return sesiones;
}

async function crearSesion(planId: string, titulo: string, s: SesionEntrada, responsable: string, anfitrionId: string, objetivo: string | null) {
  const actividad = await prisma.trainingActivity.create({
    data: {
      planId,
      title: titulo,
      type: "EXTERNAL_EVENT",
      status: "OPEN",
      enabledAt: new Date(),
      modality: "VIRTUAL",
      isRequired: false,
      targetAudience: "AMBOS",
      targetAudienceNote: s.dirigidoA || null,
      responsibleLabel: responsable || null,
      responsibleUserId: anfitrionId,
      objective: objetivo,
      startDate: enBogota(s.fecha, "00:00"),
    },
    select: { id: true },
  });
  await prisma.trainingSession.create({
    data: {
      activityId: actividad.id,
      audience: s.audience,
      startsAt: enBogota(s.fecha, s.inicio),
      endsAt: s.fin ? enBogota(s.fecha, s.fin) : null,
      modality: "VIRTUAL",
      status: "OPEN",
      meetingUrl: `${APP_URL}/sala/${actividad.id}`,
      facilitador: responsable || null,
    },
  });
  return actividad.id;
}

function tituloSesion(reunion: string, n: number, total: number, s: SesionEntrada) {
  const base = total > 1 ? `${reunion} · Sesión ${n}` : reunion;
  return s.dirigidoA ? `${base} — ${s.dirigidoA}` : base;
}

export async function crearReunionAction(_prev: EstadoReunion, fd: FormData): Promise<EstadoReunion> {
  const { session: sesion } = await accesoReuniones(true);
  const titulo = texto(fd, "titulo");
  if (titulo.length < 4) return { error: "Escribe el nombre de la reunión." };
  const sesiones = leerSesiones(fd);
  if (typeof sesiones === "string") return { error: sesiones };
  const objetivo = texto(fd, "objetivo") || null;
  const ordenDelDia = texto(fd, "ordenDelDia") || null;
  const responsable = texto(fd, "responsable");
  const area = await prisma.trainingArea.findFirst({
    where: {
      id: texto(fd, "anfitrionAreaId"),
      isActive: true,
      tutor: { status: "ACTIVE", role: { in: ["ADMIN", "TUTOR"] } },
    },
    select: { tutorId: true },
  });
  if (!area?.tutorId) return { error: "Selecciona un área anfitriona activa." };
  const anfitrionId = area.tutorId;

  const anio = Number(sesiones[0].fecha.slice(0, 4)) || new Date().getFullYear();
  const plan = await prisma.trainingPlan.create({
    data: { title: titulo, year: anio, kind: "REUNION", status: "ACTIVE", createdById: sesion.user.id, tutorId: anfitrionId, description: objetivo, summary: ordenDelDia },
    select: { id: true },
  });
  for (const [i, s] of sesiones.entries()) {
    await crearSesion(plan.id, tituloSesion(titulo, i + 1, sesiones.length, s), s, responsable, anfitrionId, objetivo);
  }
  await registrarAuditoria({ userId: sesion.user.id, action: "CREATE", entity: "TrainingPlan", entityId: plan.id, description: `Reunión abierta creada: ${titulo} · ${sesiones.length} sesión(es)` }).catch(() => {});
  revalidatePath(BASE);
  revalidatePath("/tutor/reuniones");
  redirect(`${sesion.user.role === "TUTOR" ? "/tutor/reuniones" : BASE}/${plan.id}`);
}

export async function agregarSesionAction(planId: string, _prev: EstadoReunion, fd: FormData): Promise<EstadoReunion> {
  const sesion = await requireReunionAccess(planId, undefined, true);
  const plan = await prisma.trainingPlan.findFirst({
    where: { id: planId, kind: "REUNION" },
    select: { title: true, description: true, tutorId: true, _count: { select: { activities: true } }, activities: { take: 1, select: { responsibleLabel: true } } },
  });
  if (!plan) return { error: "La reunión no existe." };
  const sesiones = leerSesiones(fd);
  if (typeof sesiones === "string") return { error: sesiones };
  const responsable = plan.activities[0]?.responsibleLabel ?? "";
  for (const [i, s] of sesiones.entries()) {
    const n = plan._count.activities + i + 1;
    await crearSesion(planId, tituloSesion(plan.title, n, n, s), s, responsable, plan.tutorId, plan.description);
  }
  await registrarAuditoria({ userId: sesion.user.id, action: "CREATE", entity: "TrainingActivity", entityId: planId, description: `${sesiones.length} sesión(es) nuevas` }).catch(() => {});
  revalidatePath(`${BASE}/${planId}`);
  revalidatePath(`/tutor/reuniones/${planId}`);
  return { error: null, ok: true };
}

/** Contenido del acta: objetivo de la sesión, desarrollo y compromisos (uno por línea). */
export async function guardarActaAction(planId: string, activityId: string, _prev: EstadoReunion, fd: FormData): Promise<EstadoReunion> {
  const sesion = await requireReunionAccess(planId, activityId, true);
  const act = await prisma.trainingActivity.findFirst({ where: { id: activityId, planId }, select: { status: true } });
  if (!act) return { error: "La sesión no existe." };
  if (act.status === "CLOSED") return { error: "La sesión está cerrada; el contenido del acta no se puede modificar." };
  const compromisos = texto(fd, "compromisos").split("\n").map((l) => l.trim()).filter(Boolean);
  const guardada = await prisma.trainingActivity.updateMany({
    where: { id: activityId, planId, status: { not: "CLOSED" } },
    data: { objective: texto(fd, "objetivo"), methodology: texto(fd, "desarrollo") || null, followUpEvidence: compromisos, ...(fd.has("ordenDelDia") ? { meetingAgenda: texto(fd, "ordenDelDia") } : {}) },
  });
  if (!guardada.count) return { error: "La sesión está cerrada; vuelve a cargar la página." };
  await registrarAuditoria({ userId: sesion.user.id, action: "UPDATE", entity: "TrainingActivity", entityId: activityId, description: "Contenido del acta guardado para esta sesión" }).catch(() => {});
  revalidatePath(`${BASE}/${planId}/sesiones/${activityId}`);
  revalidatePath(`/tutor/reuniones/${planId}/sesiones/${activityId}`);
  return { error: null, ok: true };
}

/** Acta firmada (escaneo o PDF): queda en los documentos de la sesión con prefijo ACTA. */
export async function subirActaFirmadaAction(planId: string, activityId: string, _prev: EstadoReunion, fd: FormData): Promise<EstadoReunion> {
  const sesion = await requireReunionAccess(planId, activityId, true);
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Selecciona el archivo del acta firmada." };
  const act = await prisma.trainingActivity.findFirst({ where: { id: activityId, planId }, select: { id: true } });
  if (!act) return { error: "La sesión no existe." };
  const nombre = file.name.toUpperCase().startsWith("ACTA") ? file.name : `ACTA ${file.name}`;
  await saveTrainingActivityDocument(new File([await file.arrayBuffer()], nombre, { type: file.type || "application/octet-stream" }), activityId, sesion.user.id, { ...fichaDesdeFormulario(fd), kind: "ACTA" });
  await registrarAuditoria({ userId: sesion.user.id, action: "UPDATE", entity: "TrainingActivity", entityId: activityId, description: `Acta firmada cargada: ${nombre}` }).catch(() => {});
  revalidatePath(`${BASE}/${planId}/sesiones/${activityId}`);
  revalidatePath(`/tutor/reuniones/${planId}/sesiones/${activityId}`);
  revalidatePath(`${BASE}/${planId}`);
  revalidatePath(`/tutor/reuniones/${planId}`);
  return { error: null, ok: true };
}

/** Cerrar la sesión: congela la asistencia (no admite nuevos registros). */
export async function cerrarSesionAction(planId: string, activityId: string): Promise<EstadoReunion> {
  const sesion = await requireReunionAccess(planId, activityId, true);
  const act = await prisma.trainingActivity.findFirst({ where: { id: activityId, planId }, select: { status: true } });
  if (!act) return { error: "La sesión no existe." };
  if (act.status === "CLOSED") return { error: "La sesión ya está cerrada." };
  await prisma.$transaction([
    prisma.trainingActivity.update({ where: { id: activityId }, data: { status: "CLOSED", closedAt: new Date() } }),
    prisma.trainingSession.updateMany({ where: { activityId }, data: { status: "CLOSED" } }),
  ]);
  await registrarAuditoria({ userId: sesion.user.id, action: "UPDATE", entity: "TrainingActivity", entityId: activityId, description: "Sesión cerrada" }).catch(() => {});
  revalidatePath(`${BASE}/${planId}/sesiones/${activityId}`);
  revalidatePath(`/tutor/reuniones/${planId}/sesiones/${activityId}`);
  revalidatePath(`${BASE}/${planId}`);
  revalidatePath(`/tutor/reuniones/${planId}`);
  return { error: null, ok: true };
}

/** Reabrir: solo administración, queda en la bitácora. */
export async function reabrirSesionAction(planId: string, activityId: string): Promise<EstadoReunion> {
  const sesion = await requireReunionAccess(planId, activityId, true);
  if (sesion.user.role !== "ADMIN") return { error: "Reabrir una sesión cerrada requiere permiso de administrador." };
  await prisma.$transaction([
    prisma.trainingActivity.update({ where: { id: activityId }, data: { status: "OPEN", closedAt: null } }),
    prisma.trainingSession.updateMany({ where: { activityId }, data: { status: "OPEN" } }),
  ]);
  await registrarAuditoria({ userId: sesion.user.id, action: "UPDATE", entity: "TrainingActivity", entityId: activityId, description: "Sesión reabierta" }).catch(() => {});
  revalidatePath(`${BASE}/${planId}/sesiones/${activityId}`);
  revalidatePath(`/tutor/reuniones/${planId}/sesiones/${activityId}`);
  revalidatePath(`${BASE}/${planId}`);
  revalidatePath(`/tutor/reuniones/${planId}`);
  return { error: null, ok: true };
}

/** Eliminar una sesión SIN registros (los registros son evidencia y no se borran). */
export async function eliminarSesionAction(planId: string, activityId: string): Promise<EstadoReunion> {
  await requireReunionAccess(planId, activityId, true);
  const act = await prisma.trainingActivity.findFirst({
    where: { id: activityId, planId },
    select: { _count: { select: { externalParticipants: true, attendances: { where: { attended: true } }, callConnections: true } } },
  });
  if (!act) return { error: "La sesión ya no existe." };
  if (act._count.externalParticipants + act._count.attendances + act._count.callConnections > 0) {
    return { error: "Esta sesión ya tiene registros de asistencia o conexiones: es evidencia y no se elimina. Puedes cerrarla." };
  }
  await prisma.trainingActivity.delete({ where: { id: activityId } });
  revalidatePath(`${BASE}/${planId}`);
  revalidatePath(`/tutor/reuniones/${planId}`);
  return { error: null, ok: true };
}
