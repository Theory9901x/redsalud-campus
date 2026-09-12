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
      attendances: { where: { attended: true }, select: { userId: true, registeredAt: true, source: true, user: { select: { fullName: true } } } },
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

  // OTROS ASISTENTES: funcionarios que no son integrantes (Talento Humano,
  // invitados con cuenta) y externos. Se unen las dos fuentes -asistencia
  // en firme y conexión a la sala- para que la cifra sea UNA sola: quien
  // asistió aparece aunque su tramo de conexión no haya quedado escrito.
  const idsMiembros = new Set(miembros.map((m) => m.userId).filter(Boolean));
  const otrosMapa = new Map<string, { nombre: string; externo: boolean; asistio: boolean; horaAsistencia: Date | null; minutos: number; ingresos: number; primerIngreso: Date | null; ultimaSalida: Date | null }>();
  for (const a of actividad.attendances) {
    if (idsMiembros.has(a.userId)) continue;
    otrosMapa.set(a.userId, { nombre: a.user.fullName, externo: false, asistio: true, horaAsistencia: a.registeredAt, minutos: 0, ingresos: 0, primerIngreso: null, ultimaSalida: null });
  }
  for (const [id, c] of conexionPorUsuario) {
    if (idsMiembros.has(id)) continue;
    const previo = otrosMapa.get(id);
    const base = previo ?? { nombre: "", externo: false, asistio: false, horaAsistencia: null, minutos: 0, ingresos: 0, primerIngreso: null, ultimaSalida: null };
    otrosMapa.set(id, { ...base, minutos: Math.round(c.segundos / 60), ingresos: c.ingresos, primerIngreso: c.primerIngreso, ultimaSalida: c.ultimaSalida });
  }
  const sinNombre = [...otrosMapa.entries()].filter(([, o]) => !o.nombre).map(([id]) => id);
  if (sinNombre.length) {
    const usuarios = await prisma.user.findMany({ where: { id: { in: sinNombre } }, select: { id: true, fullName: true } });
    for (const u of usuarios) otrosMapa.get(u.id)!.nombre = u.fullName;
  }
  const otros = [
    ...[...otrosMapa.values()].map((o) => ({ ...o, nombre: o.nombre || "Usuario" })),
    ...[...externos.values()].map((c) => ({ nombre: c.nombre, externo: true, asistio: true, horaAsistencia: c.primerIngreso, minutos: Math.round(c.segundos / 60), ingresos: c.ingresos, primerIngreso: c.primerIngreso, ultimaSalida: c.ultimaSalida })),
  ].sort((a, b) => (a.horaAsistencia?.getTime() ?? a.primerIngreso?.getTime() ?? 0) - (b.horaAsistencia?.getTime() ?? b.primerIngreso?.getTime() ?? 0));

  const conCuenta = filas.filter((f) => f.conCuenta).length;
  const asistieron = filas.filter((f) => f.asistio).length;
  const conectados = filas.filter((f) => f.conectado).length;
  const minutosTotales = filas.reduce((s, f) => s + f.minutos, 0) + otros.reduce((s, o) => s + o.minutos, 0);
  const quorum = conCuenta > 0 ? asistieron >= Math.floor(conCuenta / 2) + 1 : false;
  // LA cifra oficial de asistencia de la sesión: integrantes + otros asistentes.
  const otrosAsistieron = otros.filter((o) => o.asistio).length;
  const asistenciaTotal = asistieron + otrosAsistieron;

  return {
    actividad,
    sesion: actividad.sessions[0] ?? null,
    filas,
    otros,
    resumen: {
      integrantes: miembros.length,
      conCuenta,
      asistieron,
      otrosAsistieron,
      asistenciaTotal,
      conectadosTotal: conexionPorUsuario.size + externos.size,
      conectados,
      porcentaje: conCuenta > 0 ? Math.round((asistieron / conCuenta) * 100) : null,
      minutosTotales,
      quorum,
      grabaciones: actividad.documents.filter((d) => d.fileType.startsWith("video/")).length,
      documentos: actividad.documents.length,
    },
  };
}
