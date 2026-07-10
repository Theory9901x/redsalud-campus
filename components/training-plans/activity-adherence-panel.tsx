import { Progress } from "@/components/ui/progress";
import type { ActivityAdherence } from "@/lib/training-plans";

/** Curso vinculado: adherencia automática desde inscripciones completadas, sin captura manual. */
export function ActivityAdherencePanel({ adherence }: { adherence: ActivityAdherence }) {
  return (
    <div className="surface space-y-3 p-5">
      {adherence.totalExpected === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay personal activo que coincida con la dependencia y la audiencia objetivo de esta actividad.
        </p>
      ) : (
        <>
          <Progress value={adherence.percentage}>
            <div className="flex w-full items-center justify-between">
              <span className="font-display text-lg font-bold text-foreground">{adherence.percentage}%</span>
              <span className="text-sm text-muted-foreground">
                {adherence.adherentCount} de {adherence.totalExpected} completaron el curso
              </span>
            </div>
          </Progress>
          <p className="text-xs text-muted-foreground">
            Calculado automáticamente a partir de las inscripciones completadas del curso vinculado.
          </p>
        </>
      )}
    </div>
  );
}
