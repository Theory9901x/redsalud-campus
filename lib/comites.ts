import { prisma } from "@/lib/prisma";
import type { CommitteeRole } from "@prisma/client";

/**
 * MÓDULO DE COMITÉS. Un comité es un TrainingPlan con `kind = COMITE`:
 * hereda reuniones (actividades), jornadas, sala virtual, QR, asistencia y
 * trazabilidad de conexión, pero se lista, se gestiona y se mide aparte.
 */

export const ROL_COMITE: Record<CommitteeRole, { etiqueta: string; corto: string; lado: "empleador" | "trabajadores" }> = {
  PRINCIPAL_EMPLEADOR: { etiqueta: "Representante principal del empleador", corto: "Principal · empleador", lado: "empleador" },
  SUPLENTE_EMPLEADOR: { etiqueta: "Suplente del empleador", corto: "Suplente · empleador", lado: "empleador" },
  PRINCIPAL_TRABAJADORES: { etiqueta: "Representante principal de los trabajadores", corto: "Principal · trabajadores", lado: "trabajadores" },
  SUPLENTE_TRABAJADORES: { etiqueta: "Suplente de los trabajadores", corto: "Suplente · trabajadores", lado: "trabajadores" },
};

/** Orden institucional de las zonas (el de la resolución). */
export const ORDEN_ZONAS = ["Zona Norte", "Zona Centro", "Zona Sur", "Sede Administrativa"];

export type FuncionComite = { n: number; texto: string; plazo: string };

export function leerFunciones(json: unknown): FuncionComite[] {
  return Array.isArray(json) ? (json as FuncionComite[]) : [];
}

// ---------------------------------------------------------------- listado

export async function listarComites() {
  const comites = await prisma.trainingPlan.findMany({
    where: { kind: "COMITE" },
    orderBy: [{ year: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      year: true,
      status: true,
      resolutionNumber: true,
      resolutionDate: true,
      periodLabel: true,
      summary: true,
      _count: { select: { members: true, activities: true } },
      activities: {
        orderBy: { startDate: "desc" },
        select: {
          id: true,
          title: true,
          startDate: true,
          status: true,
          sessions: { orderBy: { startsAt: "asc" }, select: { startsAt: true } },
        },
      },
    },
  });

  const ahora = Date.now();
  return Promise.all(
    comites.map(async (c) => {
      const proximas = c.activities
        .flatMap((a) => a.sessions.map((s) => s.startsAt))
        .filter((f) => f.getTime() >= ahora)
        .sort((a, b) => a.getTime() - b.getTime());
      const asistencia = await asistenciaPromedio(c.id);
      return { ...c, proximaReunion: proximas[0] ?? null, asistenciaPromedio: asistencia };
    })
  );
}

/** % promedio de integrantes que asistieron a las reuniones celebradas (null si no hay datos). */
async function asistenciaPromedio(planId: string): Promise<number | null> {
  const [miembros, reuniones] = await Promise.all([
    prisma.committeeMember.findMany({ where: { planId, userId: { not: null } }, select: { userId: true } }),
    prisma.trainingActivity.findMany({
      where: { planId },
      select: { id: true, attendances: { where: { attended: true }, select: { userId: true } } },
    }),
  ]);
  const ids = new Set(miembros.map((m) => m.userId!));
  if (ids.size === 0) return null;
  const conDatos = reuniones.filter((r) => r.attendances.length > 0);
  if (conDatos.length === 0) return null;
  const pcts = conDatos.map((r) => (r.attendances.filter((a) => ids.has(a.userId)).length / ids.size) * 100);
  return Math.round(pcts.reduce((s, p) => s + p, 0) / pcts.length);
}

// ---------------------------------------------------------------- detalle

export async function getComiteDetalle(id: string) {
  const comite = await prisma.trainingPlan.findFirst({
    where: { id, kind: "COMITE" },
    include: {
      tutor: { select: { fullName: true } },
      members: {
        orderBy: [{ sortOrder: "asc" }, { fullName: "asc" }],
        include: { user: { select: { id: true, email: true, status: true, lastLoginAt: true, position: true } } },
      },
      activities: {
        orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
        include: {
          sessions: { orderBy: { startsAt: "asc" } },
          _count: { select: { attendances: true, documents: true } },
        },
      },
      documents: { orderBy: { createdAt: "desc" }, include: { uploader: { select: { fullName: true } } } },
    },
  });
  if (!comite) return null;

  // Integrantes agrupados por zona, en el orden institucional.
  const zonas = [...new Set(comite.members.map((m) => m.zone))].sort(
    (a, b) => (ORDEN_ZONAS.indexOf(a) + 1 || 99) - (ORDEN_ZONAS.indexOf(b) + 1 || 99)
  );
  const porZona = zonas.map((z) => ({ zona: z, integrantes: comite.members.filter((m) => m.zone === z) }));

  return { ...comite, porZona, funciones: leerFunciones(comite.functions) };
}

export type AsistenciaReunion = {
  activityId: string;
  titulo: string;
  fecha: Date | null;
  status: string;
  asistieron: number;
  conectados: number;
  total: number;
  porcentaje: number | null;
  minutosConectados: number;
};

/**
 * ASISTENCIA DE LOS INTEGRANTES por reunión: cuántos del comité quedaron
 * con asistencia en firme y cuántos se conectaron a la sala, sobre el
 * total de integrantes con cuenta. También la matriz integrante × reunión.
 */
export async function getAsistenciaComite(planId: string) {
  const [miembros, reuniones] = await Promise.all([
    prisma.committeeMember.findMany({
      where: { planId },
      orderBy: [{ sortOrder: "asc" }],
      select: { id: true, userId: true, fullName: true, zone: true },
    }),
    prisma.trainingActivity.findMany({
      where: { planId },
      orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        title: true,
        startDate: true,
        status: true,
        sessions: { orderBy: { startsAt: "asc" }, take: 1, select: { startsAt: true } },
        attendances: { where: { attended: true }, select: { userId: true } },
        callConnections: { select: { userId: true, durationSeconds: true } },
      },
    }),
  ]);

  const conCuenta = miembros.filter((m) => m.userId);
  const ids = new Set(conCuenta.map((m) => m.userId!));

  const porReunion: AsistenciaReunion[] = reuniones.map((r) => {
    const asistieron = new Set(r.attendances.map((a) => a.userId).filter((u) => ids.has(u)));
    const conectados = new Set(r.callConnections.map((c) => c.userId).filter((u): u is string => !!u && ids.has(u)));
    const minutos = Math.round(r.callConnections.filter((c) => c.userId && ids.has(c.userId)).reduce((s, c) => s + c.durationSeconds, 0) / 60);
    const hayDatos = r.attendances.length > 0 || r.callConnections.length > 0;
    return {
      activityId: r.id,
      titulo: r.title,
      fecha: r.sessions[0]?.startsAt ?? r.startDate,
      status: r.status,
      asistieron: asistieron.size,
      conectados: conectados.size,
      total: ids.size,
      porcentaje: hayDatos && ids.size > 0 ? Math.round((asistieron.size / ids.size) * 100) : null,
      minutosConectados: minutos,
    };
  });

  const matriz = miembros.map((m) => ({
    memberId: m.id,
    nombre: m.fullName,
    zona: m.zone,
    conCuenta: Boolean(m.userId),
    asistencias: reuniones.map((r) => (m.userId ? r.attendances.some((a) => a.userId === m.userId) : false)),
    conexiones: reuniones.map((r) => (m.userId ? r.callConnections.some((c) => c.userId === m.userId) : false)),
  }));

  const celebradas = porReunion.filter((r) => r.porcentaje !== null);
  const promedio = celebradas.length > 0 ? Math.round(celebradas.reduce((s, r) => s + r.porcentaje!, 0) / celebradas.length) : null;

  return { porReunion, matriz, promedio, integrantesConCuenta: ids.size, integrantes: miembros.length };
}
