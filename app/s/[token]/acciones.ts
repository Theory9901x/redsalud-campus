"use server";

import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getSesionPorToken, registrarAsistenciaSesion } from "@/lib/sesiones-presenciales";
import { ensureEnrollment } from "@/lib/training-plans";

/**
 * FASE 10 — Acciones de la página pública de sesión /s/[token].
 *
 * IDENTIFICACIÓN LIGERA POR DOCUMENTO: quien escanea en un auditorio no va
 * a teclear correo y contraseña con el celular en la mano. Se valida el
 * documento contra el personal ya migrado y se deja una cookie ATADA A LA
 * SESIÓN (no una sesión completa de la plataforma: identifica a la persona
 * para ESTA jornada, nada más). Si el documento no existe, se remite a
 * Talento Humano: aquí nunca se crean usuarios.
 */
const COOKIE_PREFIJO = "sesion-presencial-";

export async function getPersonaIdentificada(token: string): Promise<{ id: string; fullName: string } | null> {
  // Con sesión de la plataforma no hace falta nada más.
  const sesion = await auth();
  if (sesion?.user?.id) {
    return { id: sesion.user.id, fullName: sesion.user.name ?? "Participante" };
  }

  const jar = await cookies();
  const userId = jar.get(`${COOKIE_PREFIJO}${token}`)?.value;
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, fullName: true, status: true } });
  return user && user.status === "ACTIVE" ? { id: user.id, fullName: user.fullName } : null;
}

export type EstadoIdentificacion = { error: string | null };

export async function identificarPorDocumentoAction(
  token: string,
  _prev: EstadoIdentificacion,
  formData: FormData
): Promise<EstadoIdentificacion> {
  const documento = String(formData.get("documento") ?? "").trim();
  if (documento.length < 5) return { error: "Escribe tu número de documento." };

  const sesion = await getSesionPorToken(token);
  if (!sesion) return { error: "Esta sesión no existe." };

  const user = await prisma.user.findUnique({
    where: { documentNumber: documento },
    select: { id: true, status: true },
  });
  if (!user) {
    return {
      error:
        "Tu documento no está registrado en la plataforma. Acércate a Talento Humano para que activen tu cuenta.",
    };
  }
  if (user.status !== "ACTIVE") {
    return { error: "Tu cuenta está inactiva. Comunícate con Talento Humano." };
  }

  const jar = await cookies();
  jar.set(`${COOKIE_PREFIJO}${token}`, user.id, {
    httpOnly: true,
    sameSite: "lax",
    // La cookie vive lo que una jornada: no es una sesión de la plataforma.
    maxAge: 60 * 60 * 12,
    path: "/",
  });

  return { error: null };
}

export type ResultadoAccionSesion = { error: string | null; ok?: string };

/**
 * Registrar asistencia desde el QR. Idempotente; además auto-inscribe en la
 * actividad por la misma puerta que el resto del módulo (ensureEnrollment)
 * cuando la actividad tiene curso.
 */
export async function registrarAsistenciaQrAction(token: string): Promise<ResultadoAccionSesion> {
  const persona = await getPersonaIdentificada(token);
  if (!persona) return { error: "Primero identifícate con tu documento." };

  const sesion = await getSesionPorToken(token);
  if (!sesion) return { error: "Esta sesión no existe." };
  if (sesion.fase === "CERRADA") return { error: "Esta sesión ya cerró: no se admiten más registros." };

  const { yaEstaba } = await registrarAsistenciaSesion(sesion.id, persona.id, "QR");

  // Auto-inscripción, sin bloquear el registro si la actividad no la admite
  // (p. ej. sin curso enganchado): la asistencia presencial vale por sí sola.
  if (sesion.activity.courseId) {
    await ensureEnrollment(persona.id, sesion.activity.id).catch(() => null);
  }

  return {
    error: null,
    ok: yaEstaba ? "Tu asistencia ya estaba registrada." : "Asistencia registrada.",
  };
}
