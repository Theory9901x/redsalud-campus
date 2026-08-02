import { Target, Route, Users, UserCog, ListChecks, Hash } from "lucide-react";
import { etiquetaTrimestres } from "@/components/training-plans/labels";

type ActivityPlanCardProps = {
  activity: {
    programa: string | null;
    objective: string | null;
    methodology: string | null;
    targetAudienceNote: string | null;
    expectedAttendeesNote: string | null;
    expectedAttendees: number | null;
    responsibleLabel: string | null;
    followUpEvidence: string[];
    quarters: number[];
    sourceRow: number | null;
  };
  responsibleUserName: string | null;
};

/**
 * Lo que el Plan Institucional de Capacitaciones dice de esta línea y que,
 * hasta ahora, se guardaba pero no se mostraba en ninguna parte: objetivo,
 * metodología, a quién va dirigida en las palabras del propio plan, cuántas
 * personas se esperan, quién responde y qué evidencias exige.
 *
 * Sin esto un área entraba a "su" actividad y encontraba lo mismo que
 * cualquier jornada creada a mano: título, fecha, audiencia genérica. El PIC
 * es un documento con más matices que eso, y esos matices son justo los que
 * un área necesita para saber qué le están pidiendo.
 */
export function ActivityPlanCard({ activity, responsibleUserName }: ActivityPlanCardProps) {
  const tieneAlgo =
    activity.objective ||
    activity.methodology ||
    activity.targetAudienceNote ||
    activity.expectedAttendeesNote ||
    activity.responsibleLabel ||
    activity.followUpEvidence.length > 0;

  if (!tieneAlgo) return null;

  return (
    <div className="surface-panel space-y-5 p-6">
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
          Ficha del plan institucional
        </h2>
        {activity.programa && (
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
            {activity.programa}
          </span>
        )}
        {activity.sourceRow && (
          <span className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground">
            <Hash className="h-3 w-3" aria-hidden="true" />
            Fila {activity.sourceRow} del PIC
          </span>
        )}
      </div>

      {activity.objective && (
        <Campo icono={Target} etiqueta="Objetivo">
          {activity.objective}
        </Campo>
      )}

      {activity.methodology && (
        <Campo icono={Route} etiqueta="Metodología">
          {activity.methodology}
        </Campo>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {activity.targetAudienceNote && (
          <Campo icono={Users} etiqueta="Dirigido a">
            {activity.targetAudienceNote}
          </Campo>
        )}

        {(activity.expectedAttendeesNote || activity.expectedAttendees) && (
          <Campo icono={Users} etiqueta="Personas a capacitar">
            {activity.expectedAttendees ?? activity.expectedAttendeesNote}
          </Campo>
        )}

        {(activity.responsibleLabel || responsibleUserName) && (
          <Campo icono={UserCog} etiqueta="Responsable según el plan">
            {activity.responsibleLabel}
            {responsibleUserName && (
              <span className="mt-0.5 block text-xs text-muted-foreground">
                En la plataforma: <span className="font-medium text-foreground">{responsibleUserName}</span>
              </span>
            )}
          </Campo>
        )}

        {activity.quarters.length > 0 && (
          <Campo icono={Hash} etiqueta="Programado en">
            {etiquetaTrimestres(activity.quarters)}
          </Campo>
        )}
      </div>

      {activity.followUpEvidence.length > 0 && (
        <Campo icono={ListChecks} etiqueta="Evidencias que exige el plan">
          <ul className="mt-1 space-y-1">
            {activity.followUpEvidence.map((ev, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                {ev}
              </li>
            ))}
          </ul>
        </Campo>
      )}
    </div>
  );
}

function Campo({
  icono: Icono,
  etiqueta,
  children,
}: {
  icono: typeof Target;
  etiqueta: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2.5">
      <Icono className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{etiqueta}</p>
        <div className="mt-0.5 text-sm leading-relaxed text-foreground">{children}</div>
      </div>
    </div>
  );
}
