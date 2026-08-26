"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTrainingActivityAccess } from "@/lib/auth-helpers";
import { registrarAuditoria } from "@/lib/audit";
import {
  cerrarSesionConSnapshot,
  faseAnterior,
  faseSiguiente,
  registrarAsistenciaSesion,
  ETIQUETA_FASE,
} from "@/lib/sesiones-presenciales";

/**
 * FASE 10 — Acciones del tutor sobre una sesión presencial.
 *
 * Todas verifican la adscripción real (requireTrainingActivityAccess): la
 * fase de una sesión la cambia el tutor del área dueña o el administrador,
 * nunca un estudiante -aunque conozca la URL o el id-.
 */
async function sesionConPermiso(sesionId: string) {
  const sesion = await prisma.trainingSession.findUniqueOrThrow({
    where: { id: sesionId },
    select: { id: true, fase: true, activityId: true, activity: { select: { planId: true } } },
  });
  const { session } = await requireTrainingActivityAccess(sesion.activityId);
  return { sesion, usuario: session.user };
}

export type ResultadoSesion = { error: string | null };

export async function avanzarFaseAction(sesionId: string): Promise<ResultadoSesion> {
  const { sesion, usuario } = await sesionConPermiso(sesionId);

  const siguiente = faseSiguiente(sesion.fase);
  if (!siguiente) return { error: "La sesión ya está cerrada." };

  // Cerrar no es un paso más: congela el acta de la sesión.
  if (siguiente === "CERRADA") {
    const snapshot = await cerrarSesionConSnapshot(sesionId);
    await registrarAuditoria({
      userId: usuario.id,
      action: "UPDATE",
      entity: "TrainingActivity",
      entityId: sesion.activityId,
      description: `Cerró la sesión presencial con acta congelada: ${snapshot.asistentes} asistentes, presaber ${snapshot.presaberPresentados}, postsaber ${snapshot.postsaberPresentados}`,
    });
  } else {
    await prisma.trainingSession.update({ where: { id: sesionId }, data: { fase: siguiente } });
  }

  revalidatePath(`/tutor/planes-capacitacion/${sesion.activity.planId}`);
  return { error: null };
}

export async function retrocederFaseAction(sesionId: string): Promise<ResultadoSesion> {
  const { sesion } = await sesionConPermiso(sesionId);
  const anterior = faseAnterior(sesion.fase);
  if (!anterior) return { error: "No hay una fase anterior." };
  await prisma.trainingSession.update({ where: { id: sesionId }, data: { fase: anterior } });
  revalidatePath(`/tutor/planes-capacitacion/${sesion.activity.planId}`);
  return { error: null };
}

/** Registro manual por documento, para quien no puede escanear. */
export async function registrarAsistenciaManualAction(
  sesionId: string,
  documento: string
): Promise<ResultadoSesion & { nombre?: string }> {
  const { sesion } = await sesionConPermiso(sesionId);
  if (sesion.fase === "CERRADA") return { error: "La sesión ya está cerrada." };

  const persona = await prisma.user.findUnique({
    where: { documentNumber: documento.trim() },
    select: { id: true, fullName: true, status: true },
  });
  if (!persona) return { error: "Ese documento no está registrado en la plataforma." };
  if (persona.status !== "ACTIVE") return { error: `La cuenta de ${persona.fullName} está inactiva.` };

  const { yaEstaba } = await registrarAsistenciaSesion(sesionId, persona.id, "MANUAL");
  return {
    error: null,
    nombre: yaEstaba ? `${persona.fullName} ya estaba registrado.` : `${persona.fullName} registrado.`,
  };
}

export type EtiquetasFase = typeof ETIQUETA_FASE;
