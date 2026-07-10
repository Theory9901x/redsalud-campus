import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/brand/empty-state";
import { ClipboardList } from "lucide-react";
import { SURVEY_QUESTION_TYPE_LABELS, SURVEY_QUESTION_TYPE_ICONS } from "@/components/training-plans/survey-labels";
import type { SurveyQuestionType } from "@prisma/client";

export type SurveyQuestionItem = {
  id: string;
  type: SurveyQuestionType;
  statement: string;
  isRequired: boolean;
  scaleMin: number | null;
  scaleMax: number | null;
  options: { id: string; text: string }[];
};

export function SurveyQuestionList({
  questions,
  onDelete,
}: {
  questions: SurveyQuestionItem[];
  onDelete: (questionId: string) => Promise<void>;
}) {
  if (questions.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Sin preguntas todavía"
        description="Agrega la primera pregunta con el botón de abajo."
        className="py-10"
      />
    );
  }

  return (
    <div className="space-y-3">
      {questions.map((question, index) => {
        const TypeIcon = SURVEY_QUESTION_TYPE_ICONS[question.type];
        return (
          <div key={question.id} className="surface flex items-start gap-3 p-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-foreground">{question.statement}</p>
                {question.isRequired && (
                  <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                    Obligatoria
                  </span>
                )}
              </div>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <TypeIcon className="h-3.5 w-3.5" />
                {SURVEY_QUESTION_TYPE_LABELS[question.type]}
                {question.type === "SCALE" && ` (${question.scaleMin ?? 1} a ${question.scaleMax ?? 5})`}
              </p>
              {question.options.length > 0 && (
                <ul className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                  {question.options.map((option) => (
                    <li key={option.id} className="rounded-full bg-muted px-2 py-0.5">
                      {option.text}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <form
              action={async () => {
                "use server";
                await onDelete(question.id);
              }}
            >
              <Button type="submit" variant="ghost" size="icon-sm">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </form>
          </div>
        );
      })}
    </div>
  );
}
