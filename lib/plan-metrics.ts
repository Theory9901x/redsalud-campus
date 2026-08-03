import {
  getTrainingPlanDetail,
  getPlanAdherenceSummary,
  getPresaberPostsaberSummary,
} from "@/lib/training-plans";
import { getSurveysForPlan, buildSurveyResponseRate } from "@/lib/surveys";

/**
 * Las métricas del plan en el eje en el que se decide: el ÁREA.
 *
 * La versión anterior graficaba una barra por actividad -55 barras
 * apretadas, ilegibles- y una dona de estados que con 54 borradores no
 * decía nada. Nadie decide por actividad cuando hay 55: se decide por área
 * (¿a quién le falta contenido?, ¿quién ya abrió sus jornadas?) y por
 * ciclo (¿cuánto mejoró la gente entre presaber y postsaber?).
 */
export async function getPlanMetricsData(planId: string, areaIds: string[] | null = null) {
  const planCompleto = await getTrainingPlanDetail(planId);
  if (!planCompleto) return null;
  // Un tutor de área solo mide lo suyo: mismas fórmulas, universo acotado.
  const plan = areaIds
    ? { ...planCompleto, activities: planCompleto.activities.filter((a) => a.area && areaIds.includes(a.area.id)) }
    : planCompleto;

  const [adherenceSummary, surveys] = await Promise.all([
    getPlanAdherenceSummary({ targetDepartment: plan.targetDepartment, activities: plan.activities }),
    getSurveysForPlan(planId),
  ]);
  const adherenciaPorActividad = new Map(
    adherenceSummary.perActivity.map((a) => [a.activityId, a])
  );

  // ---- Agregado por área --------------------------------------------------
  type Area = {
    name: string;
    orden: number;
    total: number;
    conContenido: number;
    draft: number;
    open: number;
    closed: number;
    adherenciaSuma: number;
    adherenciaN: number;
  };
  const areas = new Map<string, Area>();
  for (const a of plan.activities) {
    const clave = a.area?.id ?? "sin-area";
    const area = areas.get(clave) ?? {
      name: a.area?.name ?? "Sin área",
      orden: a.area?.sortOrder ?? 99,
      total: 0,
      conContenido: 0,
      draft: 0,
      open: 0,
      closed: 0,
      adherenciaSuma: 0,
      adherenciaN: 0,
    };
    area.total += 1;
    if (a.courseId) area.conContenido += 1;
    if (a.status === "DRAFT") area.draft += 1;
    else if (a.status === "OPEN") area.open += 1;
    else area.closed += 1;
    const adh = adherenciaPorActividad.get(a.id);
    if (adh && adh.totalExpected > 0) {
      area.adherenciaSuma += adh.percentage;
      area.adherenciaN += 1;
    }
    areas.set(clave, area);
  }
  const porArea = [...areas.values()]
    .sort((x, y) => x.orden - y.orden)
    .map((a) => ({
      name: a.name,
      total: a.total,
      conContenido: a.conContenido,
      cobertura: a.total > 0 ? Math.round((a.conContenido / a.total) * 100) : null,
      adherencia: a.adherenciaN > 0 ? Math.round(a.adherenciaSuma / a.adherenciaN) : null,
      draft: a.draft,
      open: a.open,
      closed: a.closed,
    }));

  // ---- Ciclo presaber/postsaber: solo actividades con algún intento -------
  const ciclos: { titulo: string; pre: number | null; post: number | null; preN: number; postN: number }[] = [];
  for (const a of plan.activities) {
    if (!a.courseId) continue;
    const r = await getPresaberPostsaberSummary(a.id);
    if (r.presaberCantidad === 0 && r.postsaberCantidad === 0) continue;
    ciclos.push({
      titulo: a.title,
      pre: r.presaberPromedio,
      post: r.postsaberPromedio,
      preN: r.presaberCantidad,
      postN: r.postsaberCantidad,
    });
  }

  const conContenido = plan.activities.filter((a) => a.courseId).length;

  return {
    planId,
    kpis: {
      totalActividades: plan.activities.length,
      conContenido,
      cobertura: plan.activities.length > 0 ? Math.round((conContenido / plan.activities.length) * 100) : null,
      jornadasAbiertas: plan.activities.filter((a) => a.status === "OPEN").length,
      cumplimiento: adherenceSummary.overallPercentage,
      encuestas: surveys.length,
      tasaEncuestas: buildSurveyResponseRate(surveys),
    },
    porArea,
    ciclos,
  };
}

export type PlanMetricsData = NonNullable<Awaited<ReturnType<typeof getPlanMetricsData>>>;
