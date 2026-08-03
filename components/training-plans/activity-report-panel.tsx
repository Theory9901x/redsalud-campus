import { FileText, Lock } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * El acceso al INFORME DE LA JORNADA. Solo se habilita cuando la
 * capacitación está CERRADA: antes del cierre las cifras siguen moviéndose
 * -gente presentando, ventanas abiertas- y un informe a medias circularía
 * como si fuera el definitivo. La misma regla la refuerza el servidor.
 */
export function ActivityReportPanel({ activityId, cerrada }: { activityId: string; cerrada: boolean }) {
  return (
    <div className="surface flex flex-wrap items-center justify-between gap-3 p-5">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-foreground">
          <FileText className="h-4 w-4 text-primary" aria-hidden="true" />
          Informe de la jornada
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Métricas completas de adherencia: presaber y postsaber sobre el total de encuestados, resultados por persona,
          acierto por pregunta, lista de asistencia y encuestas.
        </p>
      </div>
      {cerrada ? (
        <a
          href={`/api/planes-capacitacion/actividades/${activityId}/informe`}
          className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}
        >
          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
          Descargar PDF
        </a>
      ) : (
        <span className="flex items-center gap-1.5 rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
          <Lock className="h-3.5 w-3.5" aria-hidden="true" />
          Se habilita al cerrar la jornada
        </span>
      )}
    </div>
  );
}
