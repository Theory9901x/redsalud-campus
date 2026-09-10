"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireTutorOrAdmin } from "@/lib/auth-helpers";
import { saveTrainingPlanDocument } from "@/lib/storage";
import { registrarAuditoria } from "@/lib/audit";
import { closeActivityAction, reopenActivityAction } from "@/app/admin/planes-capacitacion/actions";
import type { CommitteeRole, TrainingModality } from "@prisma/client";

export type EstadoComite = { error: string | null };

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const BASE = "/admin/comites";

function texto(fd: FormData, clave: string) {
  return String(fd.get(clave) ?? "").trim();
}

/** Crea un comité (plan con kind = COMITE), activo desde el inicio. */
export async function crearComiteAction(_prev: EstadoComite, fd: FormData): Promise<EstadoComite> {
  const sesion = await requireAdmin();
  const title = texto(fd, "title");
  if (title.length < 5) return { error: "Escribe el nombre del comité (mínimo 5 caracteres)." };
  const year = Number(texto(fd, "year")) || new Date().getFullYear();
  const resolutionDate = texto(fd, "resolutionDate");

  const comite = await prisma.trainingPlan.create({
    data: {
      kind: "COMITE",
      title,
      year,
      status: "ACTIVE",
      tutorId: sesion.user.id,
      resolutionNumber: texto(fd, "resolutionNumber") || null,
      resolutionDate: resolutionDate ? new Date(`${resolutionDate}T12:00:00`) : null,
      periodLabel: texto(fd, "periodLabel") || null,
      summary: texto(fd, "summary") || null,
    },
    select: { id: true },
  });
  await registrarAuditoria({
    userId: sesion.user.id,
    action: "CREATE",
    entity: "TrainingPlan",
    entityId: comite.id,
    description: `Creó el comité «${title}»`,
  });
  redirect(`${BASE}/${comite.id}`);
}

/** Información general: resolución, vigencia, resumen y funciones (una por línea: "texto | plazo"). */
export async function actualizarComiteAction(planId: string, _prev: EstadoComite, fd: FormData): Promise<EstadoComite> {
  await requireTutorOrAdmin();
  const resolutionDate = texto(fd, "resolutionDate");
  const funciones = texto(fd, "functions")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l, i) => {
      const [t, plazo] = l.split("|").map((x) => x.trim());
      return { n: i + 1, texto: t.replace(/^\d+[.)]\s*/, ""), plazo: plazo ?? "" };
    });

  await prisma.trainingPlan.update({
    where: { id: planId, kind: "COMITE" },
    data: {
      title: texto(fd, "title") || undefined,
      resolutionNumber: texto(fd, "resolutionNumber") || null,
      resolutionDate: resolutionDate ? new Date(`${resolutionDate}T12:00:00`) : null,
      periodLabel: texto(fd, "periodLabel") || null,
      summary: texto(fd, "summary") || null,
      functions: funciones,
    },
  });
  revalidatePath(`${BASE}/${planId}`);
  return { error: null };
}

/** Adjunta la resolución u otro documento del comité. */
export async function subirDocumentoComiteAction(planId: string, _prev: EstadoComite, fd: FormData): Promise<EstadoComite> {
  const sesion = await requireTutorOrAdmin();
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Selecciona un archivo." };
  await saveTrainingPlanDocument(file, planId, sesion.user.id);
  revalidatePath(`${BASE}/${planId}`);
  return { error: null };
}

/**
 * Agrega un integrante por documento. Si la persona tiene cuenta se toma su
 * nombre y queda vinculada (así su asistencia y conexiones se cruzan);
 * si no, se guarda tal cual y se vincula cuando se cree la cuenta.
 */
export async function agregarIntegranteAction(planId: string, _prev: EstadoComite, fd: FormData): Promise<EstadoComite> {
  await requireTutorOrAdmin();
  const documento = texto(fd, "documentNumber").replace(/\D/g, "");
  if (!documento) return { error: "Escribe el número de documento." };
  const usuario = await prisma.user.findUnique({ where: { documentNumber: documento }, select: { id: true, fullName: true, position: true } });
  const nombre = texto(fd, "fullName") || usuario?.fullName;
  if (!nombre) return { error: "No hay cuenta con ese documento: escribe el nombre completo." };

  const max = await prisma.committeeMember.aggregate({ where: { planId }, _max: { sortOrder: true } });
  try {
    await prisma.committeeMember.create({
      data: {
        planId,
        userId: usuario?.id ?? null,
        fullName: nombre,
        documentNumber: documento,
        zone: texto(fd, "zone") || "Sin zona",
        position: texto(fd, "position") || usuario?.position || null,
        role: (texto(fd, "role") || "SUPLENTE_TRABAJADORES") as CommitteeRole,
        sortOrder: (max._max.sortOrder ?? -1) + 1,
      },
    });
  } catch {
    return { error: "Esa persona ya está en el comité." };
  }
  revalidatePath(`${BASE}/${planId}`);
  return { error: null };
}

export async function quitarIntegranteAction(planId: string, memberId: string): Promise<{ error: string | null }> {
  await requireTutorOrAdmin();
  await prisma.committeeMember.delete({ where: { id: memberId } });
  revalidatePath(`${BASE}/${planId}`);
  return { error: null };
}

/**
 * Convoca una reunión: crea la actividad (evento sin curso) y su jornada en
 * un solo paso. Virtual usa la sala integrada, que registra asistencia y
 * conexiones por sí sola.
 */
export async function crearReunionAction(planId: string, _prev: EstadoComite, fd: FormData): Promise<EstadoComite> {
  await requireTutorOrAdmin();
  const title = texto(fd, "title") || "Reunión ordinaria del comité";
  const fecha = texto(fd, "date");
  const hora = texto(fd, "startTime");
  const fin = texto(fd, "endTime");
  if (!fecha || !hora) return { error: "Indica la fecha y la hora de inicio." };
  const startsAt = new Date(`${fecha}T${hora}:00`);
  if (Number.isNaN(startsAt.getTime())) return { error: "Fecha u hora inválida." };
  const modality = (texto(fd, "modality") || "VIRTUAL") as TrainingModality;
  const location = texto(fd, "location") || null;

  const actividad = await prisma.trainingActivity.create({
    data: {
      planId,
      title,
      type: "EXTERNAL_EVENT",
      startDate: new Date(`${fecha}T00:00:00`),
      targetAudience: "AMBOS",
      isRequired: false,
      status: "OPEN",
      enabledAt: new Date(),
      modality,
      objective: texto(fd, "objective") || null,
    },
    select: { id: true },
  });
  await prisma.trainingSession.create({
    data: {
      activityId: actividad.id,
      startsAt,
      endsAt: fin ? new Date(`${fecha}T${fin}:00`) : null,
      modality,
      location,
      meetingUrl: modality === "PRESENCIAL" ? null : `${APP_URL}/sala/${actividad.id}`,
      status: "OPEN",
    },
  });
  revalidatePath(`${BASE}/${planId}`);
  return { error: null };
}

export async function eliminarReunionAction(planId: string, activityId: string): Promise<{ error: string | null }> {
  await requireAdmin();
  const a = await prisma.trainingActivity.findUnique({
    where: { id: activityId },
    select: { _count: { select: { attendances: { where: { attended: true } }, callConnections: true } } },
  });
  if (!a) return { error: "La reunión ya no existe." };
  if (a._count.attendances > 0 || a._count.callConnections > 0) {
    return { error: "Esta reunión ya tiene asistencia o conexiones registradas: es evidencia y no se elimina." };
  }
  await prisma.trainingActivity.delete({ where: { id: activityId } });
  revalidatePath(`${BASE}/${planId}`);
  return { error: null };
}

/** Cierra la sesión: congela asistencia y conexiones y habilita el informe PDF. */
export async function cerrarReunionAction(planId: string, activityId: string): Promise<{ error: string | null }> {
  await requireTutorOrAdmin();
  try {
    await closeActivityAction(BASE, planId, activityId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo cerrar la sesión." };
  }
  revalidatePath(`${BASE}/${planId}`);
  revalidatePath(`${BASE}/${planId}/reuniones/${activityId}`);
  return { error: null };
}

export async function reabrirReunionAction(planId: string, activityId: string): Promise<{ error: string | null }> {
  await requireAdmin();
  try {
    await reopenActivityAction(BASE, planId, activityId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo reabrir la sesión." };
  }
  revalidatePath(`${BASE}/${planId}`);
  revalidatePath(`${BASE}/${planId}/reuniones/${activityId}`);
  return { error: null };
}
