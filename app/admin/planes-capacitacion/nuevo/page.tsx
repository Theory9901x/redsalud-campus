import { requireTutorOrAdmin } from "@/lib/auth-helpers";
import { getTutorOptions, getDepartmentOptions } from "@/lib/training-plans";
import { createTrainingPlanAction } from "@/app/admin/planes-capacitacion/actions";
import { TrainingPlanForm } from "@/components/training-plans/training-plan-form";
import { AdminPageHeader } from "@/components/admin/page-header";

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
      <AdminPageHeader
        title="Nuevo plan de capacitación"
        description="Define el cronograma; las actividades se agregan después."
      />

      <div className="surface p-6">
        <TrainingPlanForm action={action} tutors={tutors} departments={departments} isAdmin={isAdmin} />
      </div>
    </div>
  );
}
