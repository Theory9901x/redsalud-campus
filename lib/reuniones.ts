import { prisma } from "@/lib/prisma";

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
};

export async function listarReuniones() {
  const planes = await prisma.trainingPlan.findMany({
    where: { kind: "REUNION", status: { not: "ARCHIVED" } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      createdAt: true,
      tutor: { select: { fullName: true } },
      activities: {
        select: {
          id: true,
          status: true,
          responsibleLabel: true,
          sessions: { orderBy: { startsAt: "asc" }, take: 1, select: { startsAt: true } },
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
      descripcion: p.description,
      responsable: p.activities.find((a) => a.responsibleLabel)?.responsibleLabel ?? p.tutor.fullName,
      sesiones: p.activities.length,
      abiertas: p.activities.filter((a) => a.status === "OPEN").length,
      cerradas: p.activities.filter((a) => a.status === "CLOSED").length,
      registrados: p.activities.reduce((s, a) => s + a._count.externalParticipants, 0),
      actas: p.activities.filter((a) => a.documents.length > 0).length,
      primeraFecha: fechas[0] ?? null,
      ultimaFecha: fechas[fechas.length - 1] ?? null,
    };
  });
}

export async function getReunion(planId: string) {
  const plan = await prisma.trainingPlan.findFirst({
    where: { id: planId, kind: "REUNION" },
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
          sessions: { orderBy: { startsAt: "asc" }, take: 1, select: { startsAt: true, endsAt: true } },
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

export type AsistenteSesion = {
  clave: string;
  nombre: string;
  cargo: string;
  registradoEl: Date | null;
  minutos: number;
  conexiones: number;
  tipo: "registro" | "cuenta";
};

export async function getSesionReunion(planId: string, activityId: string) {
  const act = await prisma.trainingActivity.findFirst({
    where: { id: activityId, planId, plan: { kind: "REUNION" } },
    select: {
      id: true,
      title: true,
      status: true,
      closedAt: true,
      objective: true,
      methodology: true,
      followUpEvidence: true,
      targetAudienceNote: true,
      responsibleLabel: true,
      plan: { select: { id: true, title: true, description: true, summary: true } },
      sessions: { orderBy: { startsAt: "asc" }, take: 1, select: { id: true, startsAt: true, endsAt: true, meetingUrl: true, tokenPublico: true, status: true } },
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
    prisma.callConnectionLog.groupBy({
      by: ["userId", "externalParticipantId"],
      where: { activityId },
      _sum: { durationSeconds: true },
      _count: { _all: true },
    }),
  ]);
  const permanencia = new Map(conexiones.map((c) => [c.userId ?? c.externalParticipantId ?? "", { min: Math.round((c._sum.durationSeconds ?? 0) / 60), n: c._count._all }]));

  const asistentes: AsistenteSesion[] = [
    ...externos.map((e) => ({
      clave: e.id,
      nombre: e.fullName,
      cargo: e.company,
      registradoEl: e.createdAt,
      minutos: permanencia.get(e.id)?.min ?? 0,
      conexiones: permanencia.get(e.id)?.n ?? 0,
      tipo: "registro" as const,
    })),
    ...asistencias.map((a) => ({
      clave: a.user.id,
      nombre: a.user.fullName,
      cargo: a.user.position ?? "—",
      registradoEl: a.registeredAt,
      minutos: permanencia.get(a.user.id)?.min ?? 0,
      conexiones: permanencia.get(a.user.id)?.n ?? 0,
      tipo: "cuenta" as const,
    })),
  ].sort((x, y) => (x.registradoEl?.getTime() ?? 0) - (y.registradoEl?.getTime() ?? 0));

  const conectados = asistentes.filter((a) => a.minutos > 0);
  return {
    id: act.id,
    titulo: act.title,
    estado: act.status,
    cerradaEl: act.closedAt,
    objetivo: act.objective ?? act.plan.description,
    desarrollo: act.methodology ?? "",
    compromisos: act.followUpEvidence,
    dirigidoA: act.targetAudienceNote,
    responsable: act.responsibleLabel,
    reunion: { id: act.plan.id, titulo: act.plan.title, ordenDelDia: (act.plan.summary ?? "").split("\n").map((l) => l.trim()).filter(Boolean) },
    jornada: act.sessions[0] ?? null,
    documentos: act.documents,
    actaFirmada: act.documents.some((d) => d.fileName.includes("ACTA")),
    asistentes,
    resumen: {
      registrados: asistentes.length,
      conectados: conectados.length,
      permanenciaPromedio: conectados.length ? Math.round(conectados.reduce((s, a) => s + a.minutos, 0) / conectados.length) : 0,
      minutosTotales: asistentes.reduce((s, a) => s + a.minutos, 0),
    },
  };
}

export type SesionReunion = NonNullable<Awaited<ReturnType<typeof getSesionReunion>>>;
