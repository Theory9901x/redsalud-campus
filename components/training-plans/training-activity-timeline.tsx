import Link from "next/link";
import { CalendarRange, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/brand/empty-state";
import { COURSE_AUDIENCE_LABELS } from "@/components/cursos/labels";
import {
  TRAINING_ACTIVITY_TYPE_LABELS,
  TRAINING_ACTIVITY_TYPE_ICONS,
  TRAINING_ACTIVITY_STATUS_LABELS,
  TRAINING_ACTIVITY_STATUS_CLASSES,
} from "@/components/training-plans/labels";
import type { TrainingActivityStatus, TrainingActivityType, CourseAudience } from "@prisma/client";

export type TrainingActivityTimelineItem = {
  id: string;
  title: string;
  type: TrainingActivityType;
  startDate: Date;
  endDate: Date | null;
  targetAudience: CourseAudience;
  isRequired: boolean;
  status: TrainingActivityStatus;
  course: { id: string; title: string; slug: string } | null;
};

const MONTH_FORMAT = new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric" });
const DATE_FORMAT = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short" });

function groupByMonth(activities: TrainingActivityTimelineItem[]) {
  const groups = new Map<string, TrainingActivityTimelineItem[]>();
  for (const activity of activities) {
    const key = `${activity.startDate.getFullYear()}-${activity.startDate.getMonth()}`;
    const list = groups.get(key) ?? [];
    list.push(activity);
    groups.set(key, list);
  }
  return [...groups.entries()].map(([key, items]) => ({
    label: MONTH_FORMAT.format(items[0].startDate),
    key,
    items,
  }));
}

export function TrainingActivityTimeline({
  activities,
  basePath,
  planId,
  adherenceByActivity,
}: {
  activities: TrainingActivityTimelineItem[];
  /** "/admin/planes-capacitacion" o "/tutor/planes-capacitacion": el título enlaza al detalle de la actividad (documentos, Etapa 2). */
  basePath: string;
  planId: string;
  /** % de adherencia por actividad (Etapa 3), ya calculado por la página. */
  adherenceByActivity?: Record<string, number>;
}) {
  if (activities.length === 0) {
    return (
      <EmptyState
        icon={CalendarRange}
        title="Sin actividades todavía"
        description="Agrega la primera actividad del cronograma con el formulario de abajo."
      />
    );
  }

  const months = groupByMonth(activities);

  return (
    <div className="space-y-6">
      {months.map((month) => (
        <div key={month.key} className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{month.label}</p>
          <div className="space-y-2.5">
            {month.items.map((activity) => {
              const TypeIcon = TRAINING_ACTIVITY_TYPE_ICONS[activity.type];
              return (
                <div
                  key={activity.id}
                  className="surface surface-hover flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <TypeIcon className="h-5 w-5" />
                  </span>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`${basePath}/${planId}/actividades/${activity.id}`}
                        className="font-display text-sm font-bold text-foreground hover:underline"
                      >
                        {activity.title}
                      </Link>
                      {activity.isRequired && (
                        <span className="flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                          <Lock className="h-3 w-3" />
                          Obligatoria
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
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
                      {" · "}
                      {COURSE_AUDIENCE_LABELS[activity.targetAudience]}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      {DATE_FORMAT.format(activity.startDate)}
                      {activity.endDate ? ` — ${DATE_FORMAT.format(activity.endDate)}` : ""}
                    </span>
                    <Badge className={TRAINING_ACTIVITY_STATUS_CLASSES[activity.status]}>
                      {TRAINING_ACTIVITY_STATUS_LABELS[activity.status]}
                    </Badge>
                    {adherenceByActivity?.[activity.id] !== undefined && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                        {adherenceByActivity[activity.id]}% adherencia
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
