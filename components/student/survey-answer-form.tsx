"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SURVEY_QUESTION_TYPE_LABELS } from "@/components/training-plans/survey-labels";
import type { SurveyResponseFormState } from "@/app/(estudiante)/mis-encuestas/actions";
import type { SurveyQuestionType } from "@prisma/client";

const initialState: SurveyResponseFormState = { error: null };

type QuestionForAnswer = {
  id: string;
  type: SurveyQuestionType;
  statement: string;
  isRequired: boolean;
  scaleMin: number | null;
  scaleMax: number | null;
  options: { id: string; text: string }[];
};

type AnswerDraft =
  | { optionId: string }
  | { optionIds: string[] }
  | { value: number }
  | { text: string };

export function SurveyAnswerForm({
  surveyId,
  title,
  description,
  questions,
  action,
}: {
  surveyId: string;
  title: string;
  description: string | null;
  questions: QuestionForAnswer[];
  action: (prevState: SurveyResponseFormState, formData: FormData) => Promise<SurveyResponseFormState>;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [answers, setAnswers] = useState<Record<string, AnswerDraft>>({});

  function setSingleChoice(questionId: string, optionId: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: { optionId } }));
  }

  function toggleMultipleChoice(questionId: string, optionId: string) {
    setAnswers((prev) => {
      const current = prev[questionId];
      const currentIds = current && "optionIds" in current ? current.optionIds : [];
      const next = currentIds.includes(optionId)
        ? currentIds.filter((id) => id !== optionId)
        : [...currentIds, optionId];
      return { ...prev, [questionId]: { optionIds: next } };
    });
  }

  function setScale(questionId: string, value: number) {
    setAnswers((prev) => ({ ...prev, [questionId]: { value } }));
  }

  function setText(questionId: string, text: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: { text } }));
  }

  return (
    <form action={formAction} className="space-y-5">
      <div className="surface surface-accent-top p-6">
        <h1 className="font-display text-xl font-extrabold text-foreground">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        <p className="mt-2 text-xs text-muted-foreground">
          Encuesta de opinión: no tiene respuestas correctas ni nota. Se responde una sola vez.
        </p>
      </div>

      {questions.map((question, index) => {
        const answer = answers[question.id];
        return (
          <div key={question.id} className="surface space-y-3 p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground">
                  {question.statement}
                  {question.isRequired && <span className="ml-1 text-destructive">*</span>}
                </p>
                <p className="text-xs text-muted-foreground">{SURVEY_QUESTION_TYPE_LABELS[question.type]}</p>
              </div>
            </div>

            <div className="pl-10">
              {question.type === "SINGLE_CHOICE" &&
                question.options.map((option) => (
                  <label key={option.id} className="flex items-center gap-2 py-1 text-sm text-foreground">
                    <input
                      type="radio"
                      name={`question-${question.id}`}
                      checked={!!answer && "optionId" in answer && answer.optionId === option.id}
                      onChange={() => setSingleChoice(question.id, option.id)}
                      className="h-4 w-4"
                    />
                    {option.text}
                  </label>
                ))}

              {question.type === "MULTIPLE_CHOICE" &&
                question.options.map((option) => (
                  <label key={option.id} className="flex items-center gap-2 py-1 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={!!answer && "optionIds" in answer && answer.optionIds.includes(option.id)}
                      onChange={() => toggleMultipleChoice(question.id, option.id)}
                      className="h-4 w-4"
                    />
                    {option.text}
                  </label>
                ))}

              {question.type === "SCALE" && (
                <div className="flex flex-wrap gap-2">
                  {Array.from(
                    { length: (question.scaleMax ?? 5) - (question.scaleMin ?? 1) + 1 },
                    (_, i) => (question.scaleMin ?? 1) + i
                  ).map((value) => (
                    <label
                      key={value}
                      className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border text-sm font-semibold transition-colors ${
                        !!answer && "value" in answer && answer.value === value
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input text-foreground hover:bg-muted"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`scale-${question.id}`}
                        className="sr-only"
                        checked={!!answer && "value" in answer && answer.value === value}
                        onChange={() => setScale(question.id, value)}
                      />
                      {value}
                    </label>
                  ))}
                </div>
              )}

              {question.type === "TEXT" && (
                <Textarea
                  rows={3}
                  value={answer && "text" in answer ? answer.text : ""}
                  onChange={(e) => setText(question.id, e.target.value)}
                  placeholder="Escribe tu respuesta..."
                />
              )}
            </div>
          </div>
        );
      })}

      <input type="hidden" name="answersJson" value={JSON.stringify(answers)} />

      {state.error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Enviando..." : "Enviar respuestas"}
      </Button>
    </form>
  );
}
