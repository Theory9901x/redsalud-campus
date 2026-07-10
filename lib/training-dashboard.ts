import { prisma } from "@/lib/prisma";
import { trainingPlanScopeWhere, getPlanAdherenceSummary, getActivityAdherence } from "@/lib/training-plans";
import { getTargetAudienceUsers } from "@/lib/training-plans";
import type { Role, CourseAudience } from "@prisma/client";

const PERSONNEL_TYPES = ["ADMINISTRATIVO", "ASISTENCIAL"] as const;
const PERSONNEL_TYPE_LABELS: Record<(typeof PERSONNEL_TYPES)[number], string> = {
  ADMINISTRATIVO: "Administrativo",
  ASISTENCIAL: "Asistencial",
};

/**
 * Adherencia promedio por tipo de personal, considerando por cada tipo solo
 * las actividades que de verdad le aplican (targetAudience = ese tipo o
 * "Ambos"). Reutiliza getActivityAdherence tal cual, pasándole el tipo de
 * personal como audiencia explícita en vez de la audiencia declarada de la
 * actividad — no duplica el cálculo de adherencia, solo cambia a quién se
 * le mide.
 */
export async function getPersonnelTypeBreakdown(
  plans: { targetDepartment: string | null; activities: { id: string; courseId: string | null; targetAudience: CourseAudience }[] }[]
) {
  const totals = { ADMINISTRATIVO: { sum: 0, count: 0 }, ASISTENCIAL: { sum: 0, count: 0 } };

  for (const personnelType of PERSONNEL_TYPES) {
    for (const plan of plans) {
      for (const activity of plan.activities) {
        if (activity.targetAudience !== "AMBOS" && activity.targetAudience !== personnelType) continue;
        const adherence = await getActivityAdherence({
          id: activity.id,
          courseId: activity.courseId,
          targetAudience: personnelType,
          plan: { targetDepartment: plan.targetDepartment },
        });
        if (adherence.totalExpected === 0) continue;
        totals[personnelType].sum += adherence.percentage;
        totals[personnelType].count += 1;
      }
    }
  }

  return PERSONNEL_TYPES.map((type) => ({
    personnelType: type,
    label: PERSONNEL_TYPE_LABELS[type],
    averagePercentage: totals[type].count > 0 ? Math.round(totals[type].sum / totals[type].count) : null,
    activityCount: totals[type].count,
  }));
}

const MONTH_FORMAT = new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric" });

/**
 * Etapa 5: panel de indicadores. No introduce datos nuevos, solo agrega lo
 * que ya calculan la Etapa 3 (adherencia) y la Etapa 4 (encuestas) a nivel
 * de todos los planes visibles según el rol (mismo alcance de siempre:
 * ADMIN ve todo, TUTOR solo lo suyo).
 */
export async function getTrainingDashboardData(role: Role, userId: string) {
  const plans = await prisma.trainingPlan.findMany({
    where: trainingPlanScopeWhere(role, userId),
    include: { activities: true },
  });

  const planSummaries = await Promise.all(
    plans.map(async (plan) => ({
      plan,
      summary: await getPlanAdherenceSummary({ targetDepartment: plan.targetDepartment, activities: plan.activities }),
    }))
  );

  const plansWithCompliance = planSummaries.filter((p) => p.summary.overallPercentage !== null);
  const globalCompliance =
    plansWithCompliance.length > 0
      ? Math.round(
          plansWithCompliance.reduce((sum, p) => sum + p.summary.overallPercentage!, 0) / plansWithCompliance.length
        )
      : null;

  const departmentAgg = new Map<string, { sum: number; count: number }>();
  const monthAgg = new Map<string, { sum: number; count: number; sortKey: string }>();

  for (const { plan, summary } of planSummaries) {
    for (const result of summary.perActivity) {
      if (result.totalExpected === 0) continue;

      const departmentKey = plan.targetDepartment ?? "Todo el personal";
      const deptEntry = departmentAgg.get(departmentKey) ?? { sum: 0, count: 0 };
      deptEntry.sum += result.percentage;
      deptEntry.count += 1;
      departmentAgg.set(departmentKey, deptEntry);

      const activity = plan.activities.find((a) => a.id === result.activityId);
      if (!activity) continue;
      const sortKey = `${activity.startDate.getFullYear()}-${String(activity.startDate.getMonth()).padStart(2, "0")}`;
      const monthEntry = monthAgg.get(sortKey) ?? { sum: 0, count: 0, sortKey };
      monthEntry.sum += result.percentage;
      monthEntry.count += 1;
      monthAgg.set(sortKey, monthEntry);
    }
  }

  const departmentBreakdown = [...departmentAgg.entries()]
    .map(([department, { sum, count }]) => ({
      department,
      averagePercentage: Math.round(sum / count),
      activityCount: count,
    }))
    .sort((a, b) => b.averagePercentage - a.averagePercentage);

  const evolution = [...monthAgg.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, { sum, count }]) => {
      const [year, month] = key.split("-").map(Number);
      const rawLabel = MONTH_FORMAT.format(new Date(year, month, 1));
      return {
        key,
        label: rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1),
        averagePercentage: Math.round(sum / count),
      };
    });

  const planRows = planSummaries.map(({ plan, summary }) => ({
    id: plan.id,
    title: plan.title,
    year: plan.year,
    targetDepartment: plan.targetDepartment,
    status: plan.status,
    activityCount: plan.activities.length,
    overallPercentage: summary.overallPercentage,
  }));

  const surveys = await prisma.survey.findMany({
    where: { trainingPlanId: { in: plans.map((p) => p.id) } },
    include: {
      trainingPlan: { select: { title: true } },
      trainingActivity: { select: { title: true } },
      _count: { select: { responses: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const surveyRows = await Promise.all(
    surveys.map(async (survey) => {
      const targetUsers = await getTargetAudienceUsers(survey.targetDepartment, survey.targetAudience);
      const targetCount = targetUsers.length;
      const respondedCount = survey._count.responses;
      return {
        id: survey.id,
        title: survey.title,
        scope: survey.trainingActivity ? survey.trainingActivity.title : survey.trainingPlan.title,
        planId: survey.trainingPlanId,
        targetCount,
        respondedCount,
        responseRate: targetCount > 0 ? Math.round((respondedCount / targetCount) * 100) : 0,
      };
    })
  );

  const totalTarget = surveyRows.reduce((sum, r) => sum + r.targetCount, 0);
  const totalResponded = surveyRows.reduce((sum, r) => sum + r.respondedCount, 0);
  const overallResponseRate = totalTarget > 0 ? Math.round((totalResponded / totalTarget) * 100) : null;

  const personnelTypeBreakdown = await getPersonnelTypeBreakdown(plans);

  return {
    totalPlans: plans.length,
    totalActivities: plans.reduce((sum, p) => sum + p.activities.length, 0),
    globalCompliance,
    departmentBreakdown,
    evolution,
    planRows,
    surveyRows,
    overallResponseRate,
    personnelTypeBreakdown,
  };
}

export type TrainingDashboardData = Awaited<ReturnType<typeof getTrainingDashboardData>>;
