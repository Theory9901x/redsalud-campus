import { requireTutorOrAdmin } from "@/lib/auth-helpers";
import { getTutorOptions, getDepartmentOptions } from "@/lib/training-plans";
import { createTrainingPlanAction } from "@/app/admin/planes-capacitacion/actions";
import { TrainingPlanForm } from "@/components/training-plans/training-plan-form";

export default async function NuevoPlanCapacitacionPage() {
  const session = await requireTutorOrAdmin();
  const isAdmin = session.user.role === "ADMIN";

  const [tutors, departments] = await Promise.all([
    isAdmin ? getTutorOptions() : Promise.resolve([]),
    getDepartmentOptions(),
  ]);

  const action = createTrainingPlanAction.bind(null, "/admin/planes-capacitacion");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-foreground">Nuevo plan de capacitación</h1>
        <p className="text-sm text-muted-foreground">Define el cronograma; las actividades se agregan después.</p>
      </div>

      <div className="surface p-6">
        <TrainingPlanForm action={action} tutors={tutors} departments={departments} isAdmin={isAdmin} />
      </div>
    </div>
  );
}
