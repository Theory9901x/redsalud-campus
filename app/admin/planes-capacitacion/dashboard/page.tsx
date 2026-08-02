import { requireTutorOrAdmin } from "@/lib/auth-helpers";
import { getTrainingDashboardData } from "@/lib/training-dashboard";
import { getPlanMetricsData } from "@/lib/plan-metrics";
import { getAreaCoverageBreakdown } from "@/lib/training-plans";
import { TrainingDashboardView } from "@/components/training-plans/training-dashboard-view";
import { AdminPageHeader } from "@/components/admin/page-header";

const BASE_PATH = "/admin/planes-capacitacion";

export default async function AdminPlanesCapacitacionDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; plan?: string }>;
}) {
  const session = await requireTutorOrAdmin();
  const { tab, plan: planParam } = await searchParams;
  const [data, areaCoverage] = await Promise.all([
    getTrainingDashboardData(session.user.role, session.user.id),
    getAreaCoverageBreakdown(),
  ]);

  const isPlanInScope = !!planParam && data.planRows.some((p) => p.id === planParam);
  const selectedPlanMetrics = isPlanInScope ? await getPlanMetricsData(planParam) : null;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Dashboard de capacitaciones"
        description="Indicadores reales de todos los planes de la institución: adherencia, cumplimiento y encuestas."
      />
      <TrainingDashboardView
        data={data}
        areaCoverage={areaCoverage}
        basePath={BASE_PATH}
        activeTab={tab ?? "total"}
        selectedPlanId={isPlanInScope ? planParam! : null}
        selectedPlanMetrics={selectedPlanMetrics}
      />
    </div>
  );
}
