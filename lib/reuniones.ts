import { consolidarAsistencia } from "@/lib/reunion-asistencia";
export type { AsistenteSesion } from "@/lib/reunion-asistencia";
import { accesoReuniones } from "@/lib/reuniones-access";
import { alcanceSesionReunion } from "@/lib/reuniones-policy";
import { prisma } from "@/lib/prisma";
import { SIN_PRUEBAS, veePruebas } from "@/lib/pruebas";

/**
 * REUNIONES ABIERTAS (PlanKind REUNION): reuniones fuera del PIC y de los
 * comités. Modelo, sin tablas nuevas:
 *
 *   Reunión  = TrainingPlan (kind REUNION) · title, description = objetivo
 *              general, summary = orden del día (una línea por punto).
 *   Sesión   = TrainingActivity + su TrainingSession (fecha/hora, sala).
 *              objective = objetivo de la sesión · methodology = desarrollo
 *              (temas tratados) · followUpEvidence = compromisos ·
 *              targetAudienceNote = dirigido a / zonas · responsibleLabel.
 *   Asistencia = ExternalParticipant (registro abierto: nombre + cargo, el
 *              cargo va en `company`) + TrainingAttendance (con cuenta) +
 *              CallConnectionLog (permanencia real en la llamada).
 *   Acta firmada = documentos de la sesión con prefijo "ACTA ".
 */

export type ResumenSesion = {
  id: string;
  titulo: string;
  estado: "DRAFT" | "OPEN" | "CLOSED";
  dirigidoA: string | null;
  inicio: Date | null;
  fin: Date | null;
  registrados: number;
  actaFirmada: boolean;
  audience: string;
  tokenPublico: string | null;
};

export async function listarReuniones() {
  const acceso = await accesoReuniones();
  const planes = await prisma.trainingPlan.findMany({
    // Las pruebas solo las ve el admin… y quien las creó, que las administra.
    where: { ...acceso.where, status: { not: "ARCHIVED" }, ...(veePruebas(acceso.user.role) ? {} : { OR: [{ createdById: acceso.user.id }, SIN_PRUEBAS] }) },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      createdAt: true,
      createdBy: { select: { fullName: true } },
      tutor: { select: { fullName: true } },
      activities: {
        select: {
          id: true,
          status: true,
          responsibleLabel: true,
          sessions: { orderBy: { startsAt: "asc" }, take: 1, select: { startsAt: true, endsAt: true } },
          _count: { select: { externalParticipants: true } },
          documents: { where: { fileName: { contains: "ACTA" } }, select: { id: true } },
        },
      },
    },
  });
  return planes.map((p) => {
    const fechas = p.activities.map((a) => a.sessions[0]?.startsAt).filter((d): d is Date => !!d).sort((a, b) => +a - +b);
    return {
      id: p.id,
      titulo: p.title,
      creador: p.createdBy?.fullName ?? "Sin creador registrado",
      descripcion: p.description,
      responsable: p.activities.find((a) => a.responsibleLabel)?.responsibleLabel ?? p.tutor.fullName,
      sesiones: p.activities.length,
      abiertas: p.activities.filter((a) => a.status === "OPEN").length,
      cerradas: p.activities.filter((a) => a.status === "CLOSED").length,
      registrados: p.activities.reduce((s, a) => s + a._count.externalParticipants, 0),
      actas: p.activities.filter((a) => a.documents.length > 0).length,
      primeraFecha: fechas[0] ?? null,
      ultimaFecha: fechas[fechas.length - 1] ?? null,
      /** Reunión de una sola sesión: se reprograma desde la lista. */
      sesionUnica: p.activities.length === 1 && p.activities[0].sessions[0] ? { id: p.activities[0].id, inicio: p.activities[0].sessions[0].startsAt, fin: p.activities[0].sessions[0].endsAt } : null,
    };
  });
}

export async function getReunion(planId: string) {
  const acceso = await accesoReuniones();
  const plan = await prisma.trainingPlan.findFirst({
    where: { ...acceso.where, id: planId },
    select: {
      id: true,
      title: true,
      description: true,
      summary: true,
      year: true,
      createdAt: true,
      tutor: { select: { id: true, fullName: true } },
      activities: {
        select: {
          id: true,
          title: true,
          status: true,
          targetAudienceNote: true,
          responsibleLabel: true,
          sessions: { orderBy: { startsAt: "asc" }, take: 1, select: { startsAt: true, endsAt: true, audience: true, tokenPublico: true } },
          _count: { select: { externalParticipants: true } },
          documents: { where: { fileName: { contains: "ACTA" } }, select: { id: true } },
        },
      },
    },
  });
  if (!plan) return null;
  const sesiones: ResumenSesion[] = plan.activities
    .map((a) => ({
      id: a.id,
      titulo: a.title,
      estado: a.status,
      dirigidoA: a.targetAudienceNote,
      inicio: a.sessions[0]?.startsAt ?? null,
      fin: a.sessions[0]?.endsAt ?? null,
      audience: a.sessions[0]?.audience ?? "BOTH",
      tokenPublico: a.sessions[0]?.tokenPublico ?? null,
      registrados: a._count.externalParticipants,
      actaFirmada: a.documents.length > 0,
    }))
    .sort((x, y) => (x.inicio?.getTime() ?? 0) - (y.inicio?.getTime() ?? 0));
  return {
    id: plan.id,
    titulo: plan.title,
    objetivo: plan.description,
    ordenDelDia: (plan.summary ?? "").split("\n").map((l) => l.trim()).filter(Boolean),
    anio: plan.year,
    anfitrion: plan.tutor,
    responsable: plan.activities.find((a) => a.responsibleLabel)?.responsibleLabel ?? plan.tutor.fullName,
    sesiones,
  };
}

export async function getSesionReunion(planId: string, activityId: string) {
  const acceso = await accesoReuniones();
  const act = await prisma.trainingActivity.findFirst({
    where: { AND: [{ id: activityId, planId }, alcanceSesionReunion(acceso.user)] },
    select: {
      id: true,
      title: true,
      status: true,
      closedAt: true,
      areaId: true,
      responsibleUserId: true,
      objective: true,
      methodology: true,
      followUpEvidence: true,
      meetingAgenda: true,
      targetAudienceNote: true,
      responsibleLabel: true,
      plan: { select: { id: true, title: true, description: true, summary: true, createdById: true, tutorId: true, tutor: { select: { fullName: true } } } },
      sessions: { orderBy: { startsAt: "asc" }, take: 1, select: { id: true, startsAt: true, endsAt: true, meetingUrl: true, tokenPublico: true, status: true, modality: true, location: true, audience: true } },
      documents: { orderBy: { createdAt: "desc" }, include: { uploader: { select: { fullName: true } } } },
    },
  });
  if (!act) return null;

  const [externos, asistencias, conexiones] = await Promise.all([
    prisma.externalParticipant.findMany({ where: { activityId }, orderBy: { createdAt: "asc" }, select: { id: true, fullName: true, company: true, createdAt: true } }),
    prisma.trainingAttendance.findMany({
      where: { activityId, attended: true },
      orderBy: { registeredAt: "asc" },
      select: { registeredAt: true, user: { select: { id: true, fullName: true, position: true } } },
    }),
    prisma.callConnectionLog.findMany({
      where: { activityId }, orderBy: { createdAt: "asc" },
      include: { user: { select: { fullName: true, position: true } }, externalParticipant: { select: { fullName: true, company: true } } },
    }),
  ]);
  const asistentes = consolidarAsistencia(conexiones, new Date(), act.closedAt);

  const conectados = asistentes;
  return {
    id: act.id,
    titulo: act.title,
    estado: act.status,
    cerradaEl: act.closedAt,
    areaId: act.areaId,
    anfitrionId: act.responsibleUserId ?? act.plan.tutorId,
    puedeGestionar: acceso.user.role !== "SEGUIMIENTO",
    puedeEditarReunion: acceso.user.role !== "SEGUIMIENTO" && (act.plan.createdById === acceso.user.id || (acceso.user.role === "ADMIN" && acceso.user.canManageAllMeetings)),
    objetivo: act.objective ?? act.plan.description,
    desarrollo: act.methodology ?? "",
    compromisos: act.followUpEvidence,
    dirigidoA: act.targetAudienceNote,
    responsable: act.responsibleLabel || act.plan.tutor.fullName,
    reunion: { id: act.plan.id, titulo: act.plan.title, ordenDelDia: (act.meetingAgenda ?? act.plan.summary ?? "").split("\n").map((l) => l.trim()).filter(Boolean) },
    jornada: act.sessions[0] ?? null,
    documentos: act.documents,
    actaFirmada: act.documents.some((d) => d.fileName.includes("ACTA")),
    asistentes,
    tramos: conexiones,
    resumen: {
      registrados: externos.length + new Set(asistencias.map(a => a.user.id)).size,
      conectados: conectados.length,
      permanenciaPromedio: conectados.length ? Math.round(conectados.reduce((s, a) => s + a.minutos, 0) / conectados.length) : 0,
      minutosTotales: asistentes.reduce((s, a) => s + a.minutos, 0),
    },
  };
}

export type SesionReunion = NonNullable<Awaited<ReturnType<typeof getSesionReunion>>>;
