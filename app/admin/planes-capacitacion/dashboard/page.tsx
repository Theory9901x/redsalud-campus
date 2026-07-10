import { requireTutorOrAdmin } from "@/lib/auth-helpers";
import { getTrainingDashboardData } from "@/lib/training-dashboard";
import { TrainingDashboardView } from "@/components/training-plans/training-dashboard-view";

const BASE_PATH = "/admin/planes-capacitacion";

export default async function AdminPlanesCapacitacionDashboardPage() {
  const session = await requireTutorOrAdmin();
  const data = await getTrainingDashboardData(session.user.role, session.user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-foreground">Dashboard de capacitaciones</h1>
        <p className="text-sm text-muted-foreground">
          Indicadores reales de todos los planes de la institución: adherencia, cumplimiento y encuestas.
        </p>
      </div>
      <TrainingDashboardView data={data} basePath={BASE_PATH} />
    </div>
  );
}
