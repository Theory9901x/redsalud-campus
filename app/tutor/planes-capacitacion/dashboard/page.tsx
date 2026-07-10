import { requireTutorOrAdmin } from "@/lib/auth-helpers";
import { getTrainingDashboardData } from "@/lib/training-dashboard";
import { getPlanMetricsData } from "@/lib/plan-metrics";
import { TrainingDashboardView } from "@/components/training-plans/training-dashboard-view";

const BASE_PATH = "/tutor/planes-capacitacion";

export default async function TutorPlanesCapacitacionDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; plan?: string }>;
}) {
  const session = await requireTutorOrAdmin();
  const { tab, plan: planParam } = await searchParams;
  const data = await getTrainingDashboardData(session.user.role, session.user.id);

  const isPlanInScope = !!planParam && data.planRows.some((p) => p.id === planParam);
  const selectedPlanMetrics = isPlanInScope ? await getPlanMetricsData(planParam) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-foreground">Dashboard de mis capacitaciones</h1>
        <p className="text-sm text-muted-foreground">
          Indicadores reales de tus planes: adherencia, cumplimiento y encuestas.
        </p>
      </div>
      <TrainingDashboardView
        data={data}
        basePath={BASE_PATH}
        activeTab={tab ?? "total"}
        selectedPlanId={isPlanInScope ? planParam! : null}
        selectedPlanMetrics={selectedPlanMetrics}
      />
    </div>
  );
}
