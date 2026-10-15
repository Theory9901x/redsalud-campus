import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { publicUploadDiskPath } from "@/lib/storage";
import { audienciaDeActividad, getActivityAdherence, getActivityAttendanceCounts, type FiltroTrimestre } from "@/lib/training-plans";

/**
 * CONTEXTO DEL INFORME DE JORNADA: lo que el informe congelado no trae y
 * hace falta para LEER la jornada, no solo para listarla:
 *
 *  - la cobertura contra la población objetivo (convocados / integrantes),
 *  - la permanencia REAL de cada persona en la llamada (suma de sus tramos),
 *  - las jornadas dictadas y el logo institucional para el membrete.
 *
 * Se lee en vivo al generar el PDF (igual que las evidencias): la grabación
 * y las conexiones pueden completarse después del cierre.
 */
export type PermanenciaPersona = { nombre: string; minutos: number; tramos: number; externo: boolean };

export type ContextoInforme = {
  codigo: string;
  logo: string | null;
  cobertura: { convocados: number; asistieron: number; porcentaje: number; otrosAsistieron: number; audienciaComite: boolean };
  adherencia: { porcentaje: number; adherentes: number; esperados: number; automatica: boolean };
  permanencia: PermanenciaPersona[];
  jornadas: { inicio: Date; fin: Date | null; modalidad: string; estado: string }[];
  trimestres: number[];
  modalidad: string;
};

export async function getContextoInforme(activityId: string, filtro?: FiltroTrimestre | null): Promise<ContextoInforme | null> {
  const actividad = await prisma.trainingActivity.findUnique({
    where: { id: activityId },
    select: {
      id: true,
      courseId: true,
      targetAudience: true,
      audienceCommitteePlanId: true,
      quarters: true,
      modality: true,
      plan: { select: { id: true, year: true, targetDepartment: true, kind: true } },
      sessions: {
        where: filtro ? { startsAt: { gte: filtro.desde, lt: filtro.hasta } } : {},
        orderBy: { startsAt: "asc" },
        select: { startsAt: true, endsAt: true, modality: true, status: true },
      },
    },
  });
  if (!actividad) return null;
  const delTrimestre = filtro ? { trimestre: filtro.trimestre } : {};

  const [adherencia, conteos, asistieronDeLaPoblacion, asistieronTodos, grupos, ajustes] = await Promise.all([
    getActivityAdherence(actividad, filtro),
    getActivityAttendanceCounts(actividad, filtro),
    // Cobertura = asistentes DENTRO de la población objetivo, el mismo
    // universo de la adherencia: si no, el informe decía "7% asistió" y "0%
    // de adherencia" a la vez porque los asistentes eran de fuera.
    prisma.trainingAttendance
      .groupBy({ by: ["userId"], where: { activityId, attended: true, ...delTrimestre, user: audienciaDeActividad(actividad) } })
      .then((g) => g.length),
    prisma.trainingAttendance.groupBy({ by: ["userId"], where: { activityId, attended: true, ...delTrimestre } }).then((g) => g.length),
    prisma.callConnectionLog.groupBy({
      by: ["userId", "externalParticipantId", "displayName"],
      where: { activityId, ...(filtro ? { joinedAt: { gte: filtro.desde, lt: filtro.hasta } } : {}) },
      _sum: { durationSeconds: true },
      _count: { _all: true },
    }),
    prisma.institutionSettings.findUnique({ where: { id: "singleton" }, select: { logoUrl: true } }),
  ]);

  // Una persona puede aparecer con dos nombres visibles (se renombró en la
  // sala): se consolida por identidad, no por el texto.
  const porPersona = new Map<string, PermanenciaPersona>();
  for (const g of grupos) {
    const clave = g.userId ?? g.externalParticipantId ?? g.displayName;
    const previo = porPersona.get(clave);
    const minutos = Math.round((g._sum.durationSeconds ?? 0) / 60);
    if (previo) {
      previo.minutos += minutos;
      previo.tramos += g._count._all;
    } else {
      porPersona.set(clave, { nombre: g.displayName.replace(/\s*\([^)]*\)\s*$/, ""), minutos, tramos: g._count._all, externo: !g.userId });
    }
  }

  let logo: string | null = null;
  if (ajustes?.logoUrl) {
    try {
      const png = await sharp(await readFile(publicUploadDiskPath(ajustes.logoUrl))).resize(160, 160, { fit: "inside" }).png().toBuffer();
      logo = `data:image/png;base64,${png.toString("base64")}`;
    } catch {
      /* sin logo: el membrete sale solo con el nombre */
    }
  }

  return {
    codigo: `INF-${actividad.plan.year}${filtro ? `-T${filtro.trimestre}` : ""}-${actividad.id.slice(-6).toUpperCase()}`,
    logo,
    cobertura: {
      convocados: conteos.totalAudiencia,
      asistieron: asistieronDeLaPoblacion,
      porcentaje: conteos.totalAudiencia > 0 ? Math.round((asistieronDeLaPoblacion / conteos.totalAudiencia) * 100) : 0,
      otrosAsistieron: asistieronTodos - asistieronDeLaPoblacion,
      audienciaComite: conteos.audienciaComite,
    },
    adherencia: {
      porcentaje: adherencia.percentage,
      adherentes: adherencia.adherentCount,
      esperados: adherencia.totalExpected,
      automatica: adherencia.source === "AUTOMATIC",
    },
    permanencia: [...porPersona.values()].sort((a, b) => b.minutos - a.minutos),
    jornadas: actividad.sessions.map((s) => ({ inicio: s.startsAt, fin: s.endsAt, modalidad: s.modality, estado: s.status })),
    trimestres: filtro ? [filtro.trimestre] : actividad.quarters,
    modalidad: actividad.modality,
  };
}
