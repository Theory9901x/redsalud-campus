import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

/**
 * ACCESOS POR JORNADA.
 *
 * Una capacitación se dicta en una o varias JORNADAS (TrainingSession), y
 * cada jornada tiene sus propios enlaces y QR -puerta, sala, presaber,
 * postsaber e invitados- que llevan su `tokenPublico`. Lo que se registra
 * por ellos (asistencia, intentos, invitados, conexiones a la sala) queda en
 * ESA jornada.
 *
 * Los enlaces generales de la capacitación (/c/<actividad>/..., /invitado/
 * <actividad>) siguen sirviendo -hay QR impresos-: se resuelven a la jornada
 * vigente con `resolverJornadaVigente`.
 */

/** Margen alrededor de la jornada en que se considera "en curso": la gente entra antes a probar sonido. */
const ANTES_MS = 60 * 60 * 1000;
const DESPUES_MS = 60 * 60 * 1000;
/** Sin hora de fin, una jornada se asume de 4 horas. */
const DURACION_POR_DEFECTO_MS = 4 * 60 * 60 * 1000;

const SELECT_JORNADA = {
  id: true,
  activityId: true,
  tokenPublico: true,
  audience: true,
  startsAt: true,
  endsAt: true,
  meetingUrl: true,
  modality: true,
  status: true,
  fase: true,
} as const;

export type JornadaResuelta = {
  id: string;
  activityId: string;
  tokenPublico: string;
  audience: string;
  startsAt: Date;
  endsAt: Date | null;
  meetingUrl: string | null;
  modality: "VIRTUAL" | "PRESENCIAL" | "MIXTA";
  status: "DRAFT" | "OPEN" | "CLOSED";
  fase: "REGISTRO" | "PRESABER" | "CAPACITACION" | "POSTSABER" | "CERRADA";
};

function cerrada(j: Pick<JornadaResuelta, "status" | "fase">) {
  return j.status === "CLOSED" || j.fase === "CERRADA";
}

/** ¿La jornada está ocurriendo ahora (con el margen de antes y después)? */
export function jornadaEnCurso(j: Pick<JornadaResuelta, "startsAt" | "endsAt">, ahora = new Date()) {
  const t = ahora.getTime();
  const fin = (j.endsAt?.getTime() ?? j.startsAt.getTime() + DURACION_POR_DEFECTO_MS) + DESPUES_MS;
  return j.startsAt.getTime() - ANTES_MS <= t && t <= fin;
}

/**
 * La jornada "vigente" de una capacitación, para los enlaces generales:
 *  1. la que está en curso (desde 1 h antes del inicio hasta 1 h después del fin),
 *  2. si no, la próxima por venir,
 *  3. si no, la última que quedó sin cerrar.
 * Null si la capacitación no tiene jornadas abiertas: los enlaces generales
 * funcionan entonces como siempre, sin jornada.
 */
export async function resolverJornadaVigente(activityId: string, ahora = new Date()): Promise<JornadaResuelta | null> {
  const jornadas = (await prisma.trainingSession.findMany({
    where: { activityId, status: { not: "CLOSED" }, fase: { not: "CERRADA" } },
    orderBy: { startsAt: "asc" },
    select: SELECT_JORNADA,
  })) as JornadaResuelta[];
  if (jornadas.length === 0) return null;
  const t = ahora.getTime();
  const enCurso = jornadas.find((j) => jornadaEnCurso(j, ahora));
  if (enCurso) return enCurso;
  const proxima = jornadas.find((j) => j.startsAt.getTime() > t);
  if (proxima) return proxima;
  return jornadas[jornadas.length - 1];
}

/** La jornada de un token público, solo si pertenece a esta capacitación. */
export async function jornadaPorToken(token: string | null | undefined, activityId: string): Promise<JornadaResuelta | null> {
  if (!token) return null;
  const j = (await prisma.trainingSession.findUnique({ where: { tokenPublico: token }, select: SELECT_JORNADA })) as JornadaResuelta | null;
  return j && j.activityId === activityId ? j : null;
}

/**
 * La jornada que corresponde a un enlace: la del token si viene (y es de esta
 * capacitación), o la vigente si es un enlace general.
 */
export async function jornadaDeEnlace(activityId: string, token: string | null | undefined) {
  const porToken = await jornadaPorToken(token, activityId);
  if (porToken) return { jornada: porToken, explicita: true } as const;
  return { jornada: await resolverJornadaVigente(activityId), explicita: false } as const;
}

export { cerrada as jornadaCerrada };

// ------------------------------------------------------------------
// Cookie de jornada: atribuye los intentos de evaluación
// ------------------------------------------------------------------

/**
 * El enlace de evaluación (/c/...) deja esta cookie al redirigir al
 * cuestionario; el intento -borrador o envío- la lee para saber por qué
 * jornada entró la persona. Vive lo que una jornada.
 */
export const COOKIE_JORNADA = (activityId: string) => `jornada_${activityId}`;
export const DURACION_COOKIE_JORNADA_S = 12 * 60 * 60;

/** Id de la jornada por la que entró ESTA persona a la evaluación de la capacitación, o null. */
export async function jornadaDelIntento(activityId: string): Promise<string | null> {
  try {
    const jar = await cookies();
    const id = jar.get(COOKIE_JORNADA(activityId))?.value;
    if (!id) return null;
    const j = await prisma.trainingSession.findUnique({ where: { id }, select: { activityId: true } });
    return j?.activityId === activityId ? id : null;
  } catch {
    // Fuera de una petición (scripts) no hay cookies: el intento queda sin jornada.
    return null;
  }
}

// ------------------------------------------------------------------
// Conteos por jornada
// ------------------------------------------------------------------

export type ConteoJornada = { asistentes: number; presaber: number; postsaber: number; invitados: number };

/**
 * Lo registrado por los enlaces de cada jornada: asistentes (con cuenta),
 * personas que presentaron presaber y postsaber (internos + invitados), e
 * invitados registrados. Unas pocas consultas agrupadas para todas.
 */
export async function getConteosPorJornada(sessionIds: string[]): Promise<Map<string, ConteoJornada>> {
  const vacio = new Map(sessionIds.map((id) => [id, { asistentes: 0, presaber: 0, postsaber: 0, invitados: 0 }]));
  if (sessionIds.length === 0) return vacio;

  const [asistencias, intentos, invitados] = await Promise.all([
    prisma.asistenciaSesion.groupBy({ by: ["sesionId"], where: { sesionId: { in: sessionIds } }, _count: { _all: true } }),
    prisma.quizAttempt.findMany({
      where: { sessionId: { in: sessionIds }, moment: { not: null }, finishedAt: { not: null }, score: { not: null } },
      select: { sessionId: true, userId: true, moment: true },
      distinct: ["sessionId", "userId", "moment"],
    }),
    prisma.externalParticipant.findMany({
      where: { sessionId: { in: sessionIds } },
      select: { sessionId: true, attempts: { select: { moment: true } } },
    }),
  ]);

  for (const a of asistencias) vacio.get(a.sesionId)!.asistentes = a._count._all;
  for (const i of intentos) {
    const c = vacio.get(i.sessionId!);
    if (!c) continue;
    if (i.moment === "PRESABER") c.presaber += 1;
    else c.postsaber += 1;
  }
  for (const e of invitados) {
    const c = vacio.get(e.sessionId!);
    if (!c) continue;
    c.invitados += 1;
    if (e.attempts.some((x) => x.moment === "PRESABER")) c.presaber += 1;
    if (e.attempts.some((x) => x.moment === "POSTSABER")) c.postsaber += 1;
  }
  return vacio;
}

// ------------------------------------------------------------------
// Enlaces de una jornada
// ------------------------------------------------------------------

export type ClaveAcceso = "puerta" | "sala" | "presaber" | "postsaber" | "invitados";

export type AccesoJornada = { clave: ClaveAcceso; titulo: string; descripcion: string; url: string };

/**
 * El juego de enlaces de UNA jornada. Todos llevan el token de la jornada:
 * por eso lo que entra por ellos queda registrado en ella.
 */
export function accesosDeJornada(
  baseUrl: string,
  activityId: string,
  token: string,
  opciones: { conEvaluacion: boolean; modalidad: "VIRTUAL" | "PRESENCIAL" | "MIXTA"; audience?: string }
): AccesoJornada[] {
  const q = `?s=${encodeURIComponent(token)}`;
  const accesos: AccesoJornada[] = [
    {
      clave: "puerta",
      titulo: "Puerta de la jornada",
      descripcion:
        opciones.modalidad === "VIRTUAL"
          ? "Un solo QR para todo: entrar a la sala, presaber y postsaber de esta jornada."
          : "Un solo cartel para toda la jornada: registro de asistencia, presaber y postsaber según la fase que conduces.",
      url: `${baseUrl}/s/${token}`,
    },
    {
      clave: "sala",
      titulo: "Ingreso de internos",
      descripcion: "Entra a la sala de esta jornada. La conexión queda como asistencia de la jornada.",
      url: `${baseUrl}/c/${activityId}/meet${q}`,
    },
    ...(opciones.conEvaluacion
      ? [
          {
            clave: "presaber" as const,
            titulo: "Presaber",
            descripcion: "Evaluación antes de la capacitación. Pide iniciar sesión; queda en esta jornada.",
            url: `${baseUrl}/c/${activityId}/presaber${q}`,
          },
          {
            clave: "postsaber" as const,
            titulo: "Postsaber",
            descripcion: "La misma evaluación después de la capacitación. Queda en esta jornada.",
            url: `${baseUrl}/c/${activityId}/postsaber${q}`,
          },
        ]
      : []),
    {
      clave: "invitados",
      titulo: "Ingreso de externos",
      descripcion: "Gente de otras entidades: registro breve de nombre y empresa, sin cuenta. Quedan en esta jornada.",
      url: `${baseUrl}/invitado/${activityId}${q}`,
    },
  ];
  return accesos.filter((a) => a.clave === "invitados"
    ? opciones.audience !== "INTERNAL"
    : opciones.audience !== "EXTERNAL");
}
