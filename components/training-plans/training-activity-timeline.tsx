import Link from "next/link";
import { CalendarRange, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DeleteEntityButton } from "@/components/admin/delete-entity-button";
import { deleteTrainingActivityAction } from "@/app/admin/planes-capacitacion/actions";
import { EmptyState } from "@/components/brand/empty-state";
import { COURSE_AUDIENCE_LABELS } from "@/components/cursos/labels";
import {
  TRAINING_ACTIVITY_TYPE_LABELS,
  TRAINING_ACTIVITY_TYPE_ICONS,
  TRAINING_ACTIVITY_STATUS_LABELS,
  TRAINING_ACTIVITY_STATUS_CLASSES,
  etiquetaProgramacion,
} from "@/components/training-plans/labels";
import type { TrainingActivityStatus, TrainingActivityType, CourseAudience } from "@prisma/client";

export type TrainingActivityTimelineItem = {
  id: string;
  title: string;
  type: TrainingActivityType;
  startDate: Date | null;
  endDate: Date | null;
  quarters: number[];
  targetAudience: CourseAudience;
  isRequired: boolean;
  status: TrainingActivityStatus;
  course: { id: string; title: string; slug: string } | null;
};

const MONTH_FORMAT = new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric" });
const NUMERO_ROMANO = ["I", "II", "III", "IV"] as const;

/**
 * Agrupa el cronograma por el periodo al que pertenece cada actividad.
 *
 * Conviven dos formas de programar y las dos son legítimas: el PIC define el
 * año por TRIMESTRES, y una jornada ya agendada tiene su día exacto. Se
 * ordenan en la misma línea de tiempo llevando el trimestre a su primer mes
 * (I -> enero, II -> abril...), de modo que "Trimestre II" cae donde le
 * corresponde y no al final de la lista.
 */
function agruparPorPeriodo(activities: TrainingActivityTimelineItem[]) {
  const groups = new Map<string, { label: string; orden: number; items: TrainingActivityTimelineItem[] }>();

  for (const activity of activities) {
    let key: string;
    let label: string;
    let orden: number;

    if (activity.startDate) {
      key = `f-${activity.startDate.getFullYear()}-${activity.startDate.getMonth()}`;
      label = MONTH_FORMAT.format(activity.startDate);
      orden = activity.startDate.getFullYear() * 12 + activity.startDate.getMonth();
    } else {
      // Sin fecha manda el primer trimestre programado; el resto se ve en la
      // etiqueta de la propia actividad ("Trimestres I y III").
      const primerTrimestre = Math.min(...(activity.quarters.length > 0 ? activity.quarters : [0]));
      if (primerTrimestre === 0) {
        key = "sin-programar";
        label = "Sin programar";
        orden = Number.MAX_SAFE_INTEGER;
      } else {
        key = `t-${primerTrimestre}`;
        label = `Trimestre ${NUMERO_ROMANO[primerTrimestre - 1]}`;
        orden = (primerTrimestre - 1) * 3;
      }
    }

    const grupo = groups.get(key) ?? { label, orden, items: [] };
    grupo.items.push(activity);
    groups.set(key, grupo);
  }

  return [...groups.entries()]
    .map(([key, g]) => ({ key, ...g }))
    .sort((a, b) => a.orden - b.orden);
}

export function TrainingActivityTimeline({
  activities,
  basePath,
  planId,
  adherenceByActivity,
  puedeEliminar = false,
}: {
  activities: TrainingActivityTimelineItem[];
  /** Solo el admin elimina jornadas. */
  /** "/admin/planes-capacitacion" o "/tutor/planes-capacitacion": el título enlaza al detalle de la actividad (documentos, Etapa 2). */
  basePath: string;
  planId: string;
  /** % de adherencia por actividad (Etapa 3), ya calculado por la página. */
  adherenceByActivity?: Record<string, number>;
  puedeEliminar?: boolean;
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

  const periodos = agruparPorPeriodo(activities);

  return (
    <div className="space-y-6">
      {periodos.map((month) => (
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
                      {etiquetaProgramacion(activity)}
                    </span>
                    <Badge className={TRAINING_ACTIVITY_STATUS_CLASSES[activity.status]}>
                      {TRAINING_ACTIVITY_STATUS_LABELS[activity.status]}
                    </Badge>
                    {adherenceByActivity?.[activity.id] !== undefined && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                        {adherenceByActivity[activity.id]}% adherencia
                      </span>
                    )}
                    {puedeEliminar && (
                      <DeleteEntityButton
                        action={deleteTrainingActivityAction.bind(null, basePath, planId, activity.id)}
                        nombre={activity.title}
                        descripcion="Se elimina esta jornada del plan, con sus encuestas y documentos. No se puede deshacer."
                      />
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
