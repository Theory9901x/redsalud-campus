import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarRange, Users2 } from "lucide-react";
import { requireTrainingActivityAccess } from "@/lib/auth-helpers";
import {
  getTrainingActivityDetail,
  getActivityAdherence,
  getActivityAttendanceRoster,
} from "@/lib/training-plans";
import { uploadTrainingActivityDocumentAction } from "@/app/admin/planes-capacitacion/actions";
import { Badge } from "@/components/ui/badge";
import { COURSE_AUDIENCE_LABELS } from "@/components/cursos/labels";
import { TrainingDocumentList } from "@/components/training-plans/training-document-list";
import { TrainingDocumentUploadForm } from "@/components/training-plans/training-document-upload-form";
import { ActivityAdherencePanel } from "@/components/training-plans/activity-adherence-panel";
import { AttendanceRoster } from "@/components/training-plans/attendance-roster";
import {
  TRAINING_ACTIVITY_TYPE_LABELS,
  TRAINING_ACTIVITY_STATUS_LABELS,
  TRAINING_ACTIVITY_STATUS_CLASSES,
} from "@/components/training-plans/labels";

const BASE_PATH = "/admin/planes-capacitacion";
const DATE_FORMAT = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric" });

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
  const [adherence, roster] = await Promise.all([
    getActivityAdherence(activityForAdherence),
    activity.courseId ? Promise.resolve(null) : getActivityAttendanceRoster(activityForAdherence),
  ]);

  const uploadDocumentAction = uploadTrainingActivityDocumentAction.bind(null, BASE_PATH, id, activityId);

  return (
    <div className="space-y-6">
      <Link
        href={`${BASE_PATH}/${id}`}
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {activity.plan.title}
      </Link>

      <div className="surface surface-accent-top p-6">
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
          <Badge className={TRAINING_ACTIVITY_STATUS_CLASSES[activity.status]}>
            {TRAINING_ACTIVITY_STATUS_LABELS[activity.status]}
          </Badge>
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
          <AttendanceRoster activityId={activity.id} roster={roster!} />
        )}
      </div>

      <div className="space-y-3">
        <h2 className="font-display text-lg font-bold text-foreground">Documentos de la actividad</h2>
        <TrainingDocumentList documents={activity.documents} />
        <div className="surface p-4">
          <TrainingDocumentUploadForm action={uploadDocumentAction} />
        </div>
      </div>
    </div>
  );
}
