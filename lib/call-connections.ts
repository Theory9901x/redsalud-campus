import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/**
 * TRAZABILIDAD DE CONEXIÓN A LA VIDEOLLAMADA.
 *
 * Cada tramo (join → leave) se escribe UNA sola vez, cuando la persona sale
 * de la sala -nunca mientras está dentro-: no hay nada que sondear ni pintar
 * en vivo, así que este módulo no le agrega trabajo a la jornada mientras
 * ocurre. Es una tabla de anexar (los tramos nunca se editan) que se agrega
 * al leer, no al escribir.
 *
 * No es la fuente de la asistencia -eso lo sigue siendo TrainingAttendance,
 * intacto-: es el dato interno que pidió Talento Humano para auditar cuánto
 * estuvo conectada de verdad cada persona, por plan de capacitación.
 */

const DURACION_MINIMA_S = 5; // reconexiones instantáneas / recargas: ruido, no un tramo real.
const DURACION_MAXIMA_S = 12 * 3600; // salvaguarda ante un reloj de cliente desfasado.

export type RegistrarConexionInput = {
  activityId: string;
  userId?: string | null;
  externalParticipantId?: string | null;
  displayName: string;
  joinedAt: Date;
  leftAt: Date;
};

/**
 * Persiste un tramo de conexión. Silenciosa ante datos absurdos o
 * inconsistentes (tramo negativo, participante externo de otra actividad):
 * es telemetría interna, nunca debe poder tumbar ni bloquear la salida de la
 * sala de nadie.
 */
export async function registrarConexionLlamada(input: RegistrarConexionInput): Promise<void> {
  const { activityId, userId, externalParticipantId, displayName, joinedAt, leftAt } = input;
  if (!userId && !externalParticipantId) return;
  if (userId && externalParticipantId) return; // uno de los dos, nunca los dos.

  const durationSeconds = Math.floor((leftAt.getTime() - joinedAt.getTime()) / 1000);
  if (!Number.isFinite(durationSeconds) || durationSeconds < DURACION_MINIMA_S || durationSeconds > DURACION_MAXIMA_S) {
    return;
  }

  if (externalParticipantId) {
    // Un invitado solo puede registrar tramos de SU propia actividad: sin
    // esto, cualquiera con un externalParticipantId ajeno podría escribir
    // telemetría en una jornada que no es la suya.
    const pertenece = await prisma.externalParticipant.findUnique({
      where: { id: externalParticipantId },
      select: { activityId: true },
    });
    if (!pertenece || pertenece.activityId !== activityId) return;
  }

  await prisma.callConnectionLog.create({
    data: { activityId, userId: userId ?? null, externalParticipantId: externalParticipantId ?? null, displayName, joinedAt, leftAt, durationSeconds },
  });
}

export type ResumenConexiones = {
  totalTramos: number;
  personasDistintas: number;
  duracionPromedioMin: number;
  duracionTotalMin: number;
};

/** KPIs de conexión a videollamada del plan completo (o de las áreas de un tutor). */
export async function getCallConnectionSummaryForPlan(
  planId: string,
  areaIds: string[] | null
): Promise<ResumenConexiones> {
  const where = { activity: { planId, ...(areaIds ? { areaId: { in: areaIds } } : {}) } };

  const [agregado, personas] = await Promise.all([
    prisma.callConnectionLog.aggregate({ where, _count: true, _sum: { durationSeconds: true } }),
    prisma.callConnectionLog.groupBy({ by: ["userId", "externalParticipantId"], where }),
  ]);

  const totalTramos = agregado._count;
  const duracionTotalSeg = agregado._sum.durationSeconds ?? 0;

  return {
    totalTramos,
    personasDistintas: personas.length,
    duracionPromedioMin: totalTramos > 0 ? Math.round(duracionTotalSeg / totalTramos / 60) : 0,
    duracionTotalMin: Math.round(duracionTotalSeg / 60),
  };
}

/** Actividades del plan con al menos un tramo registrado, para el filtro. */
export async function getActivitiesWithConnectionsForPlan(planId: string, areaIds: string[] | null) {
  return prisma.trainingActivity.findMany({
    where: { planId, ...(areaIds ? { areaId: { in: areaIds } } : {}), callConnections: { some: {} } },
    select: { id: true, title: true },
    orderBy: { title: "asc" },
  });
}

export type FilaConexion = {
  clave: string;
  displayName: string;
  activityId: string;
  activityTitle: string;
  tramos: number;
  duracionTotalMin: number;
  ultimaConexion: Date;
};

/**
 * Trazabilidad persona × jornada, paginada. Una fila = una persona en una
 * jornada, con su tiempo TOTAL conectado (la suma de sus tramos) y cuántas
 * veces entró y salió. Ordenado por más tiempo conectado primero: es lo que
 * Talento Humano quiere ver de un vistazo -quién estuvo de verdad y quién
 * entró un momento y se fue-.
 */
export async function getCallConnectionPage(
  planId: string,
  areaIds: string[] | null,
  opciones: { activityId?: string; buscar?: string; pagina?: number; porPagina?: number } = {}
): Promise<{ filas: FilaConexion[]; total: number; pagina: number; porPagina: number }> {
  const porPagina = Math.min(Math.max(opciones.porPagina ?? 25, 5), 100);
  const pagina = Math.max(opciones.pagina ?? 1, 1);
  const buscar = opciones.buscar?.trim();

  const where = {
    activity: { planId, ...(areaIds ? { areaId: { in: areaIds } } : {}) },
    ...(opciones.activityId ? { activityId: opciones.activityId } : {}),
    ...(buscar ? { displayName: { contains: buscar, mode: "insensitive" as const } } : {}),
  };

  const by: Prisma.CallConnectionLogScalarFieldEnum[] = ["activityId", "userId", "externalParticipantId", "displayName"];

  const [grupos, todos] = await Promise.all([
    prisma.callConnectionLog.groupBy({
      by,
      where,
      _count: { _all: true },
      _sum: { durationSeconds: true },
      _max: { leftAt: true },
      orderBy: { _sum: { durationSeconds: "desc" } },
      skip: (pagina - 1) * porPagina,
      take: porPagina,
    }),
    // Bounded por conexiones reales (no por el padrón institucional): cada
    // grupo es un tramo que de verdad ocurrió, así que contar así nunca trae
    // más filas que jornadas con llamada realmente tuvieron.
    prisma.callConnectionLog.groupBy({ by, where }),
  ]);

  const activityIds = [...new Set(grupos.map((g) => g.activityId))];
  const actividades = activityIds.length
    ? await prisma.trainingActivity.findMany({ where: { id: { in: activityIds } }, select: { id: true, title: true } })
    : [];
  const tituloPorActividad = new Map(actividades.map((a) => [a.id, a.title]));

  return {
    filas: grupos.map((g) => ({
      clave: `${g.activityId}-${g.userId ?? g.externalParticipantId}`,
      displayName: g.displayName,
      activityId: g.activityId,
      activityTitle: tituloPorActividad.get(g.activityId) ?? "Actividad",
      tramos: g._count._all,
      duracionTotalMin: Math.round((g._sum.durationSeconds ?? 0) / 60),
      ultimaConexion: g._max.leftAt!,
    })),
    total: todos.length,
    pagina,
    porPagina,
  };
}
