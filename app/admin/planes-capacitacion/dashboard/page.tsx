import { requireTutorOrAdmin } from "@/lib/auth-helpers";
import { getTrainingDashboardData } from "@/lib/training-dashboard";
import { getPlanMetricsData } from "@/lib/plan-metrics";
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
  const data = await getTrainingDashboardData(session.user.role, session.user.id);

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
        basePath={BASE_PATH}
        activeTab={tab ?? "total"}
        selectedPlanId={isPlanInScope ? planParam! : null}
        selectedPlanMetrics={selectedPlanMetrics}
      />
    </div>
  );
}
