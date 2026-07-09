import { notFound } from "next/navigation";
import { CalendarRange, Building2, User } from "lucide-react";
import { requireTrainingPlanAccess } from "@/lib/auth-helpers";
import { getTrainingPlanDetail, getLinkableCourses } from "@/lib/training-plans";
import { createTrainingActivityAction } from "@/app/admin/planes-capacitacion/actions";
import { Badge } from "@/components/ui/badge";
import { TrainingActivityTimeline } from "@/components/training-plans/training-activity-timeline";
import { TrainingActivityForm } from "@/components/training-plans/training-activity-form";
import { TRAINING_PLAN_STATUS_LABELS, TRAINING_PLAN_STATUS_CLASSES } from "@/components/training-plans/labels";

export default async function AdminPlanCapacitacionDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireTrainingPlanAccess(id);

  const [plan, courses] = await Promise.all([getTrainingPlanDetail(id), getLinkableCourses()]);
  if (!plan) notFound();

  const addActivityAction = createTrainingActivityAction.bind(null, "/admin/planes-capacitacion", id);

  return (
    <div className="space-y-6">
      <div className="surface surface-accent-top p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-extrabold text-foreground">{plan.title}</h1>
            {plan.description && <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>}
          </div>
          <Badge className={TRAINING_PLAN_STATUS_CLASSES[plan.status]}>
            {TRAINING_PLAN_STATUS_LABELS[plan.status]}
          </Badge>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-5 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <CalendarRange className="h-4 w-4 text-primary" />
            {plan.year}
          </span>
          <span className="flex items-center gap-1.5">
            <Building2 className="h-4 w-4 text-primary" />
            {plan.targetDepartment}
          </span>
          <span className="flex items-center gap-1.5">
            <User className="h-4 w-4 text-primary" />
            {plan.tutor.fullName}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <h2 className="font-display text-lg font-bold text-foreground">Cronograma</h2>
          <TrainingActivityTimeline activities={plan.activities} />
        </div>

        <div className="surface h-fit space-y-4 p-5 lg:sticky lg:top-6">
          <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
            Agregar actividad
          </h2>
          <TrainingActivityForm action={addActivityAction} courses={courses} />
        </div>
      </div>
    </div>
  );
}
