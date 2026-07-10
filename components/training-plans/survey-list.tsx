import Link from "next/link";
import { ClipboardList, Users2 } from "lucide-react";
import { EmptyState } from "@/components/brand/empty-state";

export type SurveyListItem = {
  id: string;
  title: string;
  trainingActivity: { id: string; title: string } | null;
  targetCount: number;
  _count: { responses: number; questions: number };
};

export function SurveyList({
  surveys,
  basePath,
  planId,
  showActivityScope,
}: {
  surveys: SurveyListItem[];
  basePath: string;
  planId: string;
  /** En la página del plan conviene mostrar a qué actividad pertenece cada encuesta; en la de la actividad no hace falta. */
  showActivityScope: boolean;
}) {
  if (surveys.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Sin encuestas todavía"
        description="Crea la primera con el formulario de abajo."
        className="py-10"
      />
    );
  }

  return (
    <div className="space-y-2.5">
      {surveys.map((survey) => (
        <Link
          key={survey.id}
          href={`${basePath}/${planId}/encuestas/${survey.id}`}
          className="surface surface-hover flex flex-wrap items-center justify-between gap-3 p-4"
        >
          <div className="min-w-0 space-y-1">
            <p className="font-display text-sm font-bold text-foreground">{survey.title}</p>
            <p className="text-xs text-muted-foreground">
              {survey._count.questions} {survey._count.questions === 1 ? "pregunta" : "preguntas"}
              {showActivityScope && (
                <> · {survey.trainingActivity ? `Actividad: ${survey.trainingActivity.title}` : "General del plan"}</>
              )}
            </p>
          </div>
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
            <Users2 className="h-3.5 w-3.5" />
            {survey._count.responses} de {survey.targetCount} respondieron
          </span>
        </Link>
      ))}
    </div>
  );
}
