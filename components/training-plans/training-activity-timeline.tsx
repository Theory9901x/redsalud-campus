import Link from "next/link";
import { CalendarRange, Lock, MapPin, MonitorPlay } from "lucide-react";
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
  TRAINING_MODALITY_LABELS,
  etiquetaProgramacion,
} from "@/components/training-plans/labels";
import type { TrainingActivityStatus, TrainingActivityType, CourseAudience, TrainingModality } from "@prisma/client";

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
  /** FASE 10: toda actividad lleva su tag de modalidad visible. */
  modality: TrainingModality;
  course: { id: string; title: string; slug: string } | null;
  area: { id: string; name: string; sortOrder: number } | null;
  programa: string | null;
  responsibleLabel: string | null;
  // Columnas del PIC, para la vista ampliada con el formato del documento.
  objective: string | null;
  methodology: string | null;
  targetAudienceNote: string | null;
  expectedAttendeesNote: string | null;
  expectedAttendees: number | null;
  followUpEvidence: string[];
  /** La próxima jornada ya agendada, si la hay: le gana al trimestre del plan a la hora de mostrar "cuándo". */
  sessions?: { startsAt: Date; endsAt: Date | null }[];
  _count?: { sessions: number };
};


/**
 * Agrupa el cronograma por ÁREA responsable.
 *
 * Es como está organizado el plan institucional del que sale este
 * cronograma: el área es la unidad que responde por sus capacitaciones y es
 * el eje por el que se pregunta ("¿qué le falta a Calidad?"). Agrupar por
 * fecha dejaba 55 actividades en una lista plana donde no se distinguía de
 * quién era cada una.
 *
 * Cuándo ocurre cada actividad no se pierde: va en su propia etiqueta, que
 * dice el trimestre o la fecha según lo que se sepa.
 */
function agruparPorArea(activities: TrainingActivityTimelineItem[]) {
  const groups = new Map<string, { label: string; orden: number; items: TrainingActivityTimelineItem[] }>();

  for (const activity of activities) {
    const key = activity.area?.id ?? "sin-area";
    const grupo = groups.get(key) ?? {
      label: activity.area?.name ?? "Sin área asignada",
      // Las que no tienen área van al final: son las que hay que clasificar.
      orden: activity.area?.sortOrder ?? Number.MAX_SAFE_INTEGER,
      items: [],
    };
    grupo.items.push(activity);
    groups.set(key, grupo);
  }

  // Dentro del área, primero se agrupa por programa: en «Rutas Integrales»
  // hay 24 capacitaciones de cinco programas distintos y mezclarlas no deja
  // ver de qué responde cada uno.
  const porPrograma = (a: TrainingActivityTimelineItem) => a.programa ?? "";

  const cuando = (a: TrainingActivityTimelineItem) =>
    a.startDate ? a.startDate.getTime() : Math.min(...(a.quarters.length > 0 ? a.quarters : [99]));

  return [...groups.entries()]
    .map(([key, g]) => ({
      key,
      ...g,
      items: [...g.items].sort(
        (a, b) =>
          porPrograma(a).localeCompare(porPrograma(b), "es") ||
          cuando(a) - cuando(b) ||
          a.title.localeCompare(b.title, "es")
      ),
    }))
    .sort((a, b) => a.orden - b.orden);
}

export function TrainingActivityTimeline({
  activities,
  basePath,
  planId,
  adherenceByActivity,
  puedeEliminar = false,
  areasGestionables = null,
}: {
  activities: TrainingActivityTimelineItem[];
  /** Solo el admin elimina jornadas. */
  /** "/admin/planes-capacitacion" o "/tutor/planes-capacitacion": el título enlaza al detalle de la actividad (documentos, Etapa 2). */
  basePath: string;
  planId: string;
  /** % de adherencia por actividad (Etapa 3), ya calculado por la página. */
  adherenceByActivity?: Record<string, number>;
  puedeEliminar?: boolean;
  /**
   * Áreas cuya gestión le corresponde a quien mira (null = todas: admin o
   * responsable del plan). El cronograma se VE completo -cada área necesita
   * saber dónde está parada la institución-, pero la puerta de gestión de
   * una capacitación solo se le muestra a su propia área: un enlace que al
   * hacer clic responde "no autorizado" no es un enlace, es una trampa.
   */
  areasGestionables?: string[] | null;
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

  const areas = agruparPorArea(activities);

  return (
    <div className="space-y-6">
      {areas.map((grupo) => {
        // Cuántas de sus capacitaciones ya tienen curso montado. Es la
        // pregunta que se le hace al área: qué falta por subir.
        const conContenido = grupo.items.filter((a) => a.course).length;

        return (
        <div key={grupo.key} className="space-y-3">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border/60 pb-2">
            <p className="font-display text-sm font-bold uppercase tracking-wide text-foreground">{grupo.label}</p>
            <p className="text-xs text-muted-foreground">
              {grupo.items.length} {grupo.items.length === 1 ? "capacitación" : "capacitaciones"}
              {" · "}
              {conContenido === 0 ? (
                <span className="text-warning">sin contenido todavía</span>
              ) : conContenido === grupo.items.length ? (
                <span className="text-success">todas con contenido</span>
              ) : (
                <span>{conContenido} con contenido</span>
              )}
            </p>
          </div>
          <div className="space-y-2.5">
            {grupo.items.map((activity) => {
              const TypeIcon = TRAINING_ACTIVITY_TYPE_ICONS[activity.type];
              const gestionable =
                areasGestionables === null || (activity.area !== null && areasGestionables.includes(activity.area.id));
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
                      {gestionable ? (
                        <Link
                          href={`${basePath}/${planId}/actividades/${activity.id}`}
                          className="font-display text-sm font-bold text-foreground hover:underline"
                        >
                          {activity.title}
                        </Link>
                      ) : (
                        <span className="font-display text-sm font-bold text-foreground">{activity.title}</span>
                      )}
                      {activity.programa && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                          {activity.programa}
                        </span>
                      )}
                      {/* FASE 10: la modalidad siempre visible, con su ícono. */}
                      <span className="flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">
                        {activity.modality === "PRESENCIAL" ? (
                          <MapPin className="h-3 w-3" />
                        ) : (
                          <MonitorPlay className="h-3 w-3" />
                        )}
                        {TRAINING_MODALITY_LABELS[activity.modality]}
                      </span>
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
                        <span className="text-warning">Sin contenido todavía</span>
                      )}
                      {" · "}
                      {COURSE_AUDIENCE_LABELS[activity.targetAudience]}
                      {activity.responsibleLabel && (
                        <>
                          {" · "}
                          {activity.responsibleLabel}
                        </>
                      )}
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
        );
      })}
    </div>
  );
}
