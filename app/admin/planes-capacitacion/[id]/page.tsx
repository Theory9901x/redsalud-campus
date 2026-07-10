import { notFound } from "next/navigation";
import Link from "next/link";
import { CalendarRange, Building2, User, FileText, Gauge, ClipboardList, Plus } from "lucide-react";
import { requireTrainingPlanAccess } from "@/lib/auth-helpers";
import { getTrainingPlanDetail, getLinkableCourses, getPlanAdherenceSummary } from "@/lib/training-plans";
import { getSurveysForPlan } from "@/lib/surveys";
import { createTrainingActivityAction, uploadTrainingPlanDocumentAction } from "@/app/admin/planes-capacitacion/actions";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TrainingActivityTimeline } from "@/components/training-plans/training-activity-timeline";
import { TrainingActivityForm } from "@/components/training-plans/training-activity-form";
import { TrainingDocumentList } from "@/components/training-plans/training-document-list";
import { TrainingDocumentUploadForm } from "@/components/training-plans/training-document-upload-form";
import { SurveyList } from "@/components/training-plans/survey-list";
import { TRAINING_PLAN_STATUS_LABELS, TRAINING_PLAN_STATUS_CLASSES } from "@/components/training-plans/labels";

const BASE_PATH = "/admin/planes-capacitacion";

export default async function AdminPlanCapacitacionDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireTrainingPlanAccess(id);

  const [plan, courses, surveys] = await Promise.all([
    getTrainingPlanDetail(id),
    getLinkableCourses(),
    getSurveysForPlan(id),
  ]);
  if (!plan) notFound();

  const adherenceSummary = await getPlanAdherenceSummary({
    targetDepartment: plan.targetDepartment,
    activities: plan.activities,
  });
  const adherenceByActivity = Object.fromEntries(
    adherenceSummary.perActivity.map((a) => [a.activityId, a.percentage])
  );

  const addActivityAction = createTrainingActivityAction.bind(null, BASE_PATH, id);
  const uploadDocumentAction = uploadTrainingPlanDocumentAction.bind(null, BASE_PATH, id);

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
          <span className="flex items-center gap-1.5">
            <Gauge className="h-4 w-4 text-primary" />
            {adherenceSummary.overallPercentage !== null
              ? `${adherenceSummary.overallPercentage}% de cumplimiento`
              : "Sin datos de cumplimiento aún"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <h2 className="font-display text-lg font-bold text-foreground">Cronograma</h2>
          <TrainingActivityTimeline
            activities={plan.activities}
            basePath={BASE_PATH}
            planId={id}
            adherenceByActivity={adherenceByActivity}
          />
        </div>

        <div className="surface h-fit space-y-4 p-5 lg:sticky lg:top-6">
          <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
            Agregar actividad
          </h2>
          <TrainingActivityForm action={addActivityAction} courses={courses} />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <h2 className="font-display text-lg font-bold text-foreground">Documentos del plan</h2>
        </div>
        <TrainingDocumentList documents={plan.documents} />
        <div className="surface p-4">
          <TrainingDocumentUploadForm action={uploadDocumentAction} />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" />
            <h2 className="font-display text-lg font-bold text-foreground">Encuestas</h2>
          </div>
          <Link
            href={`${BASE_PATH}/${id}/encuestas/nueva`}
            className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}
          >
            <Plus className="h-4 w-4" />
            Nueva encuesta
          </Link>
        </div>
        <SurveyList surveys={surveys} basePath={BASE_PATH} planId={id} showActivityScope />
      </div>
    </div>
  );
}
