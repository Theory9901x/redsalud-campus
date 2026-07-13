import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarRange, Users2, ClipboardList, Plus } from "lucide-react";
import { requireTrainingActivityAccess } from "@/lib/auth-helpers";
import {
  getTrainingActivityDetail,
  getActivityAdherence,
  getActivityAttendanceRoster,
  getActivityCompletionRoster,
} from "@/lib/training-plans";
import { getSurveysForActivity } from "@/lib/surveys";
import {
  uploadTrainingActivityDocumentAction,
  enableActivityAction,
  closeActivityAction,
} from "@/app/admin/planes-capacitacion/actions";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { COURSE_AUDIENCE_LABELS } from "@/components/cursos/labels";
import { TrainingDocumentList } from "@/components/training-plans/training-document-list";
import { TrainingDocumentUploadForm } from "@/components/training-plans/training-document-upload-form";
import { ActivityAdherencePanel } from "@/components/training-plans/activity-adherence-panel";
import { AttendanceRoster } from "@/components/training-plans/attendance-roster";
import { ActivityLifecycleActions } from "@/components/training-plans/activity-lifecycle-actions";
import { NonAdherentList } from "@/components/training-plans/non-adherent-list";
import { SurveyList } from "@/components/training-plans/survey-list";
import {
  TRAINING_ACTIVITY_TYPE_LABELS,
  TRAINING_ACTIVITY_STATUS_LABELS,
  TRAINING_ACTIVITY_STATUS_CLASSES,
} from "@/components/training-plans/labels";

const BASE_PATH = "/admin/planes-capacitacion";
const DATE_FORMAT = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric" });
const DATETIME_FORMAT = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit" });

export default async function AdminActividadDetallePage({
  params,
}: {
  params: Promise<{ id: string; activityId: string }>;
}) {
  const { id, activityId } = await params;
  await requireTrainingActivityAccess(activityId);

  const activity = await getTrainingActivityDetail(activityId);
  if (!activity || activity.planId !== id) notFound();

  const activityForAdherence = {
    id: activity.id,
    courseId: activity.courseId,
    targetAudience: activity.targetAudience,
    plan: { targetDepartment: activity.plan.targetDepartment },
  };
  const isClosed = activity.status === "CLOSED";

  const [adherence, roster, completionRoster, surveys] = await Promise.all([
    getActivityAdherence(activityForAdherence),
    activity.courseId ? Promise.resolve(null) : getActivityAttendanceRoster(activityForAdherence),
    activity.courseId && isClosed
      ? getActivityCompletionRoster({ ...activityForAdherence, courseId: activity.courseId })
      : Promise.resolve(null),
    getSurveysForActivity(activityId),
  ]);

  const nonAdherentUsers = activity.courseId
    ? (completionRoster ?? []).filter((u) => !u.completed)
    : (roster ?? []).filter((u) => !u.attended);

  const uploadDocumentAction = uploadTrainingActivityDocumentAction.bind(null, BASE_PATH, id, activityId);
  const enableAction = enableActivityAction.bind(null, BASE_PATH, id, activityId);
  const closeAction = closeActivityAction.bind(null, BASE_PATH, id, activityId);

  return (
    <div className="space-y-6">
      <Link
        href={`${BASE_PATH}/${id}`}
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {activity.plan.title}
      </Link>

      <div className="surface-panel surface-accent-top p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-extrabold text-foreground">{activity.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {activity.course ? (
                <>
                  Curso:{" "}
                  <Link href={`/cursos/${activity.course.slug}`} target="_blank" className="text-primary hover:underline">
                    {activity.course.title}
                  </Link>
                </>
              ) : activity.type === "EXTERNAL_EVENT" ? (
                TRAINING_ACTIVITY_TYPE_LABELS.EXTERNAL_EVENT
              ) : (
                "No aplica · gestión directa"
              )}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge className={TRAINING_ACTIVITY_STATUS_CLASSES[activity.status]}>
              {TRAINING_ACTIVITY_STATUS_LABELS[activity.status]}
            </Badge>
            <ActivityLifecycleActions
              status={activity.status}
              closedAtLabel={activity.closedAt ? DATETIME_FORMAT.format(activity.closedAt) : null}
              onEnable={enableAction}
              onClose={closeAction}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-5 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <CalendarRange className="h-4 w-4 text-primary" />
            {DATE_FORMAT.format(activity.startDate)}
            {activity.endDate ? ` — ${DATE_FORMAT.format(activity.endDate)}` : ""}
          </span>
          <span className="flex items-center gap-1.5">
            <Users2 className="h-4 w-4 text-primary" />
            {COURSE_AUDIENCE_LABELS[activity.targetAudience]}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="font-display text-lg font-bold text-foreground">Adherencia y cumplimiento</h2>
        {activity.courseId ? (
          <ActivityAdherencePanel adherence={adherence} />
        ) : (
          <AttendanceRoster activityId={activity.id} roster={roster!} locked={isClosed} />
        )}
        {isClosed && <NonAdherentList users={nonAdherentUsers} />}
      </div>

      <div className="space-y-3">
        <h2 className="font-display text-lg font-bold text-foreground">Documentos de la actividad</h2>
        <TrainingDocumentList documents={activity.documents} />
        <div className="surface p-4">
          <TrainingDocumentUploadForm action={uploadDocumentAction} />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" />
            <h2 className="font-display text-lg font-bold text-foreground">Encuestas de esta actividad</h2>
          </div>
          <Link
            href={`${BASE_PATH}/${id}/encuestas/nueva?actividad=${activityId}`}
            className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}
          >
            <Plus className="h-4 w-4" />
            Nueva encuesta
          </Link>
        </div>
        <SurveyList surveys={surveys} basePath={BASE_PATH} planId={id} showActivityScope={false} />
      </div>
    </div>
  );
}
