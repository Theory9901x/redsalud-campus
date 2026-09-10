import { prisma } from "@/lib/prisma";
import { ROL_COMITE } from "@/lib/comites";

/**
 * FICHA DE UNA REUNIÓN del comité: la gestión de CADA sesión por separado,
 * como registro de base de datos. Quién del comité asistió (y a qué hora),
 * quién se conectó y cuánto estuvo, documentos y grabaciones, y el estado
 * para cerrar y generar el informe.
 */
export async function getReunionComite(planId: string, activityId: string) {
  const actividad = await prisma.trainingActivity.findFirst({
    where: { id: activityId, planId },
    include: {
      plan: { select: { id: true, title: true, kind: true, members: { orderBy: { sortOrder: "asc" }, select: { id: true, userId: true, fullName: true, zone: true, role: true, position: true } } } },
      sessions: { orderBy: { startsAt: "asc" } },
      attendances: { where: { attended: true }, select: { userId: true, registeredAt: true, source: true } },
      callConnections: { orderBy: { joinedAt: "asc" }, select: { userId: true, externalParticipantId: true, displayName: true, joinedAt: true, leftAt: true, durationSeconds: true } },
      documents: { orderBy: { createdAt: "desc" }, include: { uploader: { select: { fullName: true } } } },
    },
  });
  if (!actividad || actividad.plan.kind !== "COMITE") return null;

  const miembros = actividad.plan.members;
  const asistenciaPorUsuario = new Map(actividad.attendances.map((a) => [a.userId, a]));

  type Conexion = { primerIngreso: Date; ultimaSalida: Date; segundos: number; ingresos: number };
  const conexionPorUsuario = new Map<string, Conexion>();
  const externos = new Map<string, Conexion & { nombre: string }>();
  for (const c of actividad.callConnections) {
    const clave = c.userId ?? `ext:${c.externalParticipantId ?? c.displayName}`;
    const mapa = c.userId ? conexionPorUsuario : externos;
    const previo = mapa.get(clave);
    if (previo) {
      previo.segundos += c.durationSeconds;
      previo.ingresos += 1;
      if (c.leftAt > previo.ultimaSalida) previo.ultimaSalida = c.leftAt;
    } else {
      mapa.set(clave, { primerIngreso: c.joinedAt, ultimaSalida: c.leftAt, segundos: c.durationSeconds, ingresos: 1, nombre: c.displayName } as Conexion & { nombre: string });
    }
  }

  const filas = miembros.map((m) => {
    const asistencia = m.userId ? asistenciaPorUsuario.get(m.userId) : undefined;
    const conexion = m.userId ? conexionPorUsuario.get(m.userId) : undefined;
    return {
      memberId: m.id,
      nombre: m.fullName,
      zona: m.zone,
      cargo: m.position,
      rol: ROL_COMITE[m.role].corto,
      conCuenta: Boolean(m.userId),
      asistio: Boolean(asistencia),
      horaAsistencia: asistencia?.registeredAt ?? null,
      origen: asistencia?.source ?? null,
      conectado: Boolean(conexion),
      primerIngreso: conexion?.primerIngreso ?? null,
      ultimaSalida: conexion?.ultimaSalida ?? null,
      minutos: conexion ? Math.round(conexion.segundos / 60) : 0,
      ingresos: conexion?.ingresos ?? 0,
    };
  });

  // Personas que entraron a la sala sin ser integrantes (invitados, otros funcionarios).
  const idsMiembros = new Set(miembros.map((m) => m.userId).filter(Boolean));
  const otrosUsuarios = [...conexionPorUsuario.entries()].filter(([id]) => !idsMiembros.has(id));
  const otrosIds = otrosUsuarios.map(([id]) => id);
  const nombresOtros = otrosIds.length
    ? new Map((await prisma.user.findMany({ where: { id: { in: otrosIds } }, select: { id: true, fullName: true } })).map((u) => [u.id, u.fullName]))
    : new Map<string, string>();
  const otros = [
    ...otrosUsuarios.map(([id, c]) => ({ nombre: nombresOtros.get(id) ?? "Usuario", externo: false, minutos: Math.round(c.segundos / 60), ingresos: c.ingresos, primerIngreso: c.primerIngreso })),
    ...[...externos.values()].map((c) => ({ nombre: c.nombre, externo: true, minutos: Math.round(c.segundos / 60), ingresos: c.ingresos, primerIngreso: c.primerIngreso })),
  ];

  const conCuenta = filas.filter((f) => f.conCuenta).length;
  const asistieron = filas.filter((f) => f.asistio).length;
  const conectados = filas.filter((f) => f.conectado).length;
  const minutosTotales = filas.reduce((s, f) => s + f.minutos, 0);
  const quorum = conCuenta > 0 ? asistieron >= Math.floor(conCuenta / 2) + 1 : false;

  return {
    actividad,
    sesion: actividad.sessions[0] ?? null,
    filas,
    otros,
    resumen: {
      integrantes: miembros.length,
      conCuenta,
      asistieron,
      conectados,
      porcentaje: conCuenta > 0 ? Math.round((asistieron / conCuenta) * 100) : null,
      minutosTotales,
      quorum,
      grabaciones: actividad.documents.filter((d) => d.fileType.startsWith("video/")).length,
      documentos: actividad.documents.length,
    },
  };
}
