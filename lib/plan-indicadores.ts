import { prisma } from "@/lib/prisma";
import { targetAudienceUserWhere, getFrozenActivityReport, getCycleResults } from "@/lib/training-plans";
import type { CourseAudience } from "@prisma/client";

export { semaforo, UMBRAL_VERDE, UMBRAL_AMARILLO, type Semaforo } from "@/lib/semaforo-indicadores";

/**
 * INDICADORES DEL PLAN DE CAPACITACIONES.
 *
 * Los tres que la entidad mide, con su ficha técnica:
 *
 * 1. Adherencia institucional del conocimiento (principal). Por persona,
 *    ((postsaber − presaber) / presaber) × 100, promediado sobre quienes
 *    tienen AMBOS intentos, y solo sobre jornadas CERRADAS: mientras la
 *    jornada sigue abierta la gente aún está presentando y el número se
 *    movería solo.
 * 2. Cobertura de contenido: líneas del PIC con curso montado.
 * 3. Asistencia efectiva: quién quedó registrado frente a la audiencia
 *    objetivo de cada línea.
 *
 * Todo se calcula solo, en tiempo real. Nadie marca nada a mano: el
 * trimestre sale de `quarters`, el cierre de `closedAt` y la asistencia de
 * los registros que deja el propio recorrido del estudiante.
 */


export type Indicadores = {
  adherencia: {
    /** Puntos porcentuales de mejora; null si nadie ha completado el ciclo. */
    valor: number | null;
    personas: number;
    actividadesCerradas: number;
  };
  cobertura: { valor: number; conContenido: number; total: number };
  asistencia: { valor: number; asistentes: number; audiencia: number };
};

export type IndicadoresPorArea = Indicadores & { areaId: string; areaNombre: string };

export type PlanIndicadores = {
  planTitulo: string;
  anual: Indicadores;
  porTrimestre: { trimestre: number; indicadores: Indicadores }[];
  /** Desagregación del acumulado del año, para el detalle bajo las tarjetas. */
  porArea: IndicadoresPorArea[];
};

/** Lo que hace falta saber de una línea del PIC para agregarla en cualquier corte. */
type MetricaActividad = {
  areaId: string;
  areaNombre: string;
  quarters: number[];
  cerrada: boolean;
  conContenido: boolean;
  audiencia: number;
  asistentes: number;
  /** Variación por persona (%), solo de jornadas cerradas con evaluación. */
  variaciones: number[];
};

function agregar(actividades: MetricaActividad[]): Indicadores {
  const variaciones = actividades.flatMap((a) => a.variaciones);
  const conContenido = actividades.filter((a) => a.conContenido).length;
  const audiencia = actividades.reduce((s, a) => s + a.audiencia, 0);
  const asistentes = actividades.reduce((s, a) => s + a.asistentes, 0);

  return {
    adherencia: {
      valor:
        variaciones.length > 0
          ? Math.round(variaciones.reduce((s, v) => s + v, 0) / variaciones.length)
          : null,
      personas: variaciones.length,
      actividadesCerradas: actividades.filter((a) => a.cerrada && a.variaciones.length > 0).length,
    },
    cobertura: {
      valor: actividades.length > 0 ? Math.round((conContenido / actividades.length) * 100) : 0,
      conContenido,
      total: actividades.length,
    },
    asistencia: {
      valor: audiencia > 0 ? Math.round((asistentes / audiencia) * 100) : 0,
      asistentes,
      audiencia,
    },
  };
}

/**
 * `areaIds` acota el universo: un tutor de área ve sus indicadores con las
 * mismas fórmulas, no unas propias. null = institucional, todas las áreas.
 */
export async function getPlanIndicators(planId: string, areaIds: string[] | null): Promise<PlanIndicadores | null> {
  const plan = await prisma.trainingPlan.findUnique({
    where: { id: planId },
    select: { title: true, targetDepartment: true },
  });
  if (!plan) return null;

  const actividades = await prisma.trainingActivity.findMany({
    where: { planId, ...(areaIds ? { areaId: { in: areaIds } } : {}) },
    select: {
      id: true,
      quarters: true,
      closedAt: true,
      courseId: true,
      targetAudience: true,
      reportSnapshot: true,
      area: { select: { id: true, name: true } },
    },
  });
  if (actividades.length === 0) {
    const vacio = agregar([]);
    return {
      planTitulo: plan.title,
      anual: vacio,
      porTrimestre: [1, 2, 3, 4].map((t) => ({ trimestre: t, indicadores: vacio })),
      porArea: [],
    };
  }

  // La audiencia objetivo depende solo de (dependencia del plan × tipo de
  // personal), no de la actividad: tres conteos en vez de uno por línea.
  const audiencias: CourseAudience[] = ["AMBOS", "ASISTENCIAL", "ADMINISTRATIVO"];
  const conteosAudiencia = new Map<CourseAudience, number>(
    await Promise.all(
      audiencias.map(
        async (a) =>
          [a, await prisma.user.count({ where: targetAudienceUserWhere(plan.targetDepartment, a) })] as const
      )
    )
  );

  const asistenciaPorActividad = new Map(
    (
      await prisma.trainingAttendance.groupBy({
        by: ["activityId"],
        where: { activityId: { in: actividades.map((a) => a.id) }, attended: true },
        _count: true,
      })
    ).map((r) => [r.activityId, r._count])
  );

  const metricas: MetricaActividad[] = [];
  for (const a of actividades) {
    const variaciones: number[] = [];

    // Solo jornadas cerradas: con la jornada abierta el indicador se movería
    // con cada intento y no sería comparable entre áreas.
    if (a.closedAt && a.courseId) {
      // El informe congelado al cerrar es la fuente preferente: es justo lo
      // que se firmó, y no cambia si después se toca un intento.
      const congelado = a.reportSnapshot ? await getFrozenActivityReport(a.id) : null;
      const personas = congelado?.personas ?? (await getCycleResults(a.id))?.personas ?? [];
      for (const p of personas) {
        // Ambos intentos, y un presaber mayor que cero: dividir por cero no
        // es "mejoró infinito", es que no hay línea base con la que comparar.
        if (p.presaber === null || p.postsaber === null || p.presaber <= 0) continue;
        variaciones.push(((p.postsaber - p.presaber) / p.presaber) * 100);
      }
    }

    metricas.push({
      areaId: a.area?.id ?? "sin-area",
      areaNombre: a.area?.name ?? "Sin área",
      quarters: a.quarters,
      cerrada: a.closedAt !== null,
      conContenido: a.courseId !== null,
      audiencia: conteosAudiencia.get(a.targetAudience) ?? 0,
      asistentes: asistenciaPorActividad.get(a.id) ?? 0,
      variaciones,
    });
  }

  const porArea = [...new Map(metricas.map((m) => [m.areaId, m])).keys()]
    .map((areaId) => {
      const suyas = metricas.filter((m) => m.areaId === areaId);
      return { areaId, areaNombre: suyas[0].areaNombre, ...agregar(suyas) };
    })
    .sort((a, b) => a.areaNombre.localeCompare(b.areaNombre, "es"));

  return {
    planTitulo: plan.title,
    anual: agregar(metricas),
    // Una línea puede estar en varios trimestres: cuenta en cada uno, que es
    // como la programó el PIC.
    porTrimestre: [1, 2, 3, 4].map((t) => ({
      trimestre: t,
      indicadores: agregar(metricas.filter((m) => m.quarters.includes(t))),
    })),
    porArea,
  };
}
