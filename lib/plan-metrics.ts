import {
  getTrainingPlanDetail,
  getPlanAdherenceSummary,
  buildAdherenceBarData,
  buildActivityStatusCounts,
} from "@/lib/training-plans";
import { getSurveysForPlan, buildSurveyResponseRate } from "@/lib/surveys";

/**
 * Ensambla las props de PlanMetricsView para un plan por su id. Pensado para
 * llamadores que NO tienen ya los datos del plan en contexto (el dashboard,
 * pestaña "Por plan"): la propia página del plan calcula esto inline porque
 * ya tiene plan/adherenceSummary/surveys cargados para sus otras pestañas, y
 * llamar aquí duplicaría esas consultas.
 */
export async function getPlanMetricsData(planId: string) {
  const plan = await getTrainingPlanDetail(planId);
  if (!plan) return null;

  const [adherenceSummary, surveys] = await Promise.all([
    getPlanAdherenceSummary({ targetDepartment: plan.targetDepartment, activities: plan.activities }),
    getSurveysForPlan(planId),
  ]);

  return {
    planId,
    overallPercentage: adherenceSummary.overallPercentage,
    adherenceBarData: buildAdherenceBarData(plan.activities, adherenceSummary.perActivity),
    statusPieData: buildActivityStatusCounts(plan.activities),
    surveyResponseRate: buildSurveyResponseRate(surveys),
    totalActivities: plan.activities.length,
    totalSurveys: surveys.length,
  };
}
