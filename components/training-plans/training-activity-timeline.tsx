import Link from "next/link";
import { CalendarRange, Lock, MapPin, MonitorPlay } from "lucide-react";
import { DeleteEntityButton } from "@/components/admin/delete-entity-button";
import { deleteTrainingActivityAction } from "@/app/admin/planes-capacitacion/actions";
import { EmptyState } from "@/components/brand/empty-state";
import { COURSE_AUDIENCE_LABELS } from "@/components/cursos/labels";
import {
  TRAINING_ACTIVITY_TYPE_LABELS,
  TRAINING_ACTIVITY_TYPE_ICONS,
  TRAINING_ACTIVITY_STATUS_LABELS,
  TRAINING_MODALITY_LABELS,
  etiquetaProgramacion,
  tituloLegible,
} from "@/components/training-plans/labels";
import { TrimestresChip, nombreTrimestre, trimestreEnCurso } from "@/components/training-plans/trimestres-chip";
import { PildoraEstado, escalon } from "@/components/training-plans/plan-visual";
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

/**
 * Agrupa por TRIMESTRE del PIC: cada trimestre es un apartado propio, con
 * el que está en curso marcado. Una capacitación programada en varios
 * trimestres aparece en cada uno de ellos, que es como se mide: lo que
 * toca en el trimestre, no una lista donde tres trimestres van revueltos
 * en un solo lado.
 */
function agruparPorTrimestre(activities: TrainingActivityTimelineItem[], soloTrimestre = 0) {
  const grupos = new Map<number, TrainingActivityTimelineItem[]>();
  // Sin trimestre en el PIC pero con jornada o fecha: se deduce de la fecha,
  // que es donde de verdad ocurre. Solo queda "sin trimestre" lo que no
  // tiene ni lo uno ni lo otro.
  const trimestresDe = (a: TrainingActivityTimelineItem): number[] => {
    if (a.quarters.length > 0) return a.quarters;
    const fecha = a.sessions?.[0]?.startsAt ?? a.startDate;
    return fecha ? [Math.floor(fecha.getMonth() / 3) + 1] : [0];
  };
  for (const a of activities) {
    for (const t of trimestresDe(a)) {
      // Con un trimestre filtrado solo se arma SU apartado: una capacitación
      // que también va en T1 no hace aparecer un "Trimestre I" al pedir T4.
      if (soloTrimestre && t !== soloTrimestre) continue;
      grupos.set(t, [...(grupos.get(t) ?? []), a]);
    }
  }
  const porArea = (a: TrainingActivityTimelineItem, b: TrainingActivityTimelineItem) =>
    (a.area?.sortOrder ?? 99) - (b.area?.sortOrder ?? 99) || a.title.localeCompare(b.title, "es");
  return [...grupos.entries()]
    .sort(([a], [b]) => (a === 0 ? 5 : a) - (b === 0 ? 5 : b))
    .map(([t, items]) => ({
      key: `t${t}`,
      label: t === 0 ? "Sin trimestre programado" : nombreTrimestre(t),
      enCurso: t === trimestreEnCurso(),
      orden: t,
      items: [...items].sort(porArea),
    }));
}

export function TrainingActivityTimeline({
  activities,
  basePath,
  planId,
  adherenceByActivity,
  puedeEliminar = false,
  areasGestionables = null,
  agruparPor = "trimestre",
  trimestre = 0,
}: {
  /** Trimestre filtrado (0 = todos). */
  trimestre?: number;
  activities: TrainingActivityTimelineItem[];
  /** Eje del cronograma: por trimestre (apartados separados) o por área responsable. */
  agruparPor?: "area" | "trimestre";
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

  const areas = agruparPor === "trimestre" ? agruparPorTrimestre(activities, trimestre) : agruparPorArea(activities);

  return (
    <div className="space-y-6">
      {areas.map((grupo) => {
        const enCurso = "enCurso" in grupo && grupo.enCurso === true;
        // Con curso o "No aplica" (adherencia por asistencia): las dos son
        // válidas, así que se informa, no se alerta.
        const conContenido = grupo.items.filter((a) => a.course).length;
        const porAsistencia = grupo.items.length - conContenido;

        return (
        <div key={grupo.key} className="space-y-3">
          <div className="grupo-cabecera pt-1" data-en-curso={enCurso}>
            <span className="grupo-sello" aria-hidden="true">
              {agruparPor === "trimestre"
                ? grupo.key === "t0" ? "—" : `T${grupo.key.slice(1)}`
                : grupo.label.slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 font-display text-[0.98rem] font-bold leading-tight text-foreground">
                {grupo.label}
                {enCurso && (
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/8 px-1.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em] text-primary">
                    <span className="punto-vivo" aria-hidden="true" />En curso
                  </span>
                )}
              </p>
            <p className="text-xs text-muted-foreground">
              {grupo.items.length} {grupo.items.length === 1 ? "capacitación" : "capacitaciones"}
              {" · "}
              {[conContenido > 0 && `${conContenido} con curso`, porAsistencia > 0 && `${porAsistencia} por asistencia`].filter(Boolean).join(" · ")}
            </p>
            </div>
            <span className="grupo-linea" aria-hidden="true" />
          </div>
          <div className="space-y-2.5">
            {grupo.items.map((activity, idx) => {
              const TypeIcon = TRAINING_ACTIVITY_TYPE_ICONS[activity.type];
              const gestionable =
                areasGestionables === null || (activity.area !== null && areasGestionables.includes(activity.area.id));
              return (
                <div
                  key={activity.id}
                  data-estado={activity.status}
                  style={escalon(Math.min(idx, 12))}
                  className="actividad-item revelar flex flex-col gap-3 p-4 pl-5 sm:flex-row sm:items-center sm:gap-4"
                >
                  <span className="actividad-icono">
                    <TypeIcon className="h-5 w-5" />
                  </span>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {gestionable ? (
                        <Link
                          href={`${basePath}/${planId}/actividades/${activity.id}`}
                          className="font-display text-sm font-bold text-foreground hover:underline"
                        >
                          {tituloLegible(activity.title)}
                        </Link>
                      ) : (
                        <span className="font-display text-sm font-bold text-foreground">{tituloLegible(activity.title)}</span>
                      )}
                      {activity.programa && (
                        <span className="chip-dato chip-dato-primario">
                          {activity.programa}
                        </span>
                      )}
                      {/* FASE 10: la modalidad siempre visible, con su ícono. */}
                      <span className="chip-dato">
                        {activity.modality === "PRESENCIAL" ? (
                          <MapPin className="h-3 w-3" />
                        ) : (
                          <MonitorPlay className="h-3 w-3" />
                        )}
                        {TRAINING_MODALITY_LABELS[activity.modality]}
                      </span>
                      {activity.isRequired && (
                        <span className="chip-dato chip-dato-alerta">
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
                        "Sin curso (no aplica) · adherencia por asistencia"
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

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {/* El trimestre, visible y comparable entre tarjetas; la
                        fecha concreta solo cuando ya hay jornada o fecha. */}
                    <TrimestresChip quarters={activity.quarters.length > 0 ? activity.quarters : (() => { const f = activity.sessions?.[0]?.startsAt ?? activity.startDate; return f ? [Math.floor(f.getMonth() / 3) + 1] : []; })()} />
                    {(activity.sessions?.[0] || activity.startDate) && (
                      <span className="text-xs font-medium text-muted-foreground">{etiquetaProgramacion(activity)}</span>
                    )}
                    <PildoraEstado estado={activity.status}>{TRAINING_ACTIVITY_STATUS_LABELS[activity.status]}</PildoraEstado>
                    {adherenceByActivity?.[activity.id] !== undefined && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/8 px-2 py-0.5 text-[11px] font-bold tabular-nums text-primary">
                        {adherenceByActivity[activity.id]}%<span className="font-semibold text-primary/70">adherencia</span>
                      </span>
                    )}
                    {puedeEliminar && (
                      <DeleteEntityButton
                        action={deleteTrainingActivityAction.bind(null, basePath, planId, activity.id)}
                        nombre={tituloLegible(activity.title)}
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
