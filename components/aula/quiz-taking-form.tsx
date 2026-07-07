"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { submitQuizAttemptAction, type QuizSubmitState } from "@/app/aula/[courseId]/quiz/[quizId]/actions";
import type { QuestionType } from "@prisma/client";

const initialState: QuizSubmitState = { error: null };

type OptionView = { id: string; text: string };
type QuestionView = {
  id: string;
  type: QuestionType;
  statement: string;
  score: number;
  options: OptionView[];
};

export function QuizTakingForm({
  courseId,
  quizId,
  title,
  description,
  passingScore,
  timeLimitMinutes,
  attemptNumber,
  maxAttempts,
  questions,
  initiallyPassed,
  initialBestScore,
  initialAttemptsRemaining,
}: {
  courseId: string;
  quizId: string;
  title: string;
  description: string | null;
  passingScore: number;
  timeLimitMinutes: number | null;
  attemptNumber: number;
  maxAttempts: number;
  questions: QuestionView[];
  initiallyPassed: boolean;
  initialBestScore: number | null;
  initialAttemptsRemaining: number;
}) {
  const action = submitQuizAttemptAction.bind(null, courseId, quizId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const [secondsLeft, setSecondsLeft] = useState(timeLimitMinutes ? timeLimitMinutes * 60 : null);

  useEffect(() => {
    if (secondsLeft === null || state.result) return;
    if (secondsLeft <= 0) {
      formRef.current?.requestSubmit();
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((s) => (s === null ? null : s - 1)), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft, state.result]);

  // `state.result` (local a esta instancia del componente) tiene prioridad
  // sobre los props "initial*" que vienen del servidor: enviar la respuesta
  // dispara revalidatePath, lo que hace que Next.js recalcule esta misma
  // ruta y nos pase props nuevos (p. ej. initiallyPassed=true) casi de
  // inmediato. Si dejáramos que esos props ganaran, la pantalla de
  // resultado desaparecería apenas se recibiera el refresco del servidor.
  if (!state.result && initiallyPassed) {
    return (
      <div className="surface flex flex-col items-center gap-2 p-10 text-center">
        <CheckCircle2 className="h-12 w-12 text-success" />
        <h1 className="font-display text-2xl font-extrabold text-foreground">Ya aprobaste este cuestionario</h1>
        <p className="text-sm text-muted-foreground">
          Tu mejor puntaje fue <span className="font-semibold text-foreground">{initialBestScore}%</span> (mínimo{" "}
          {passingScore}%).
        </p>
        <Link href={`/aula/${courseId}`} className={cn(buttonVariants({ variant: "outline" }), "mt-2")}>
          Volver al aula
        </Link>
      </div>
    );
  }

  if (!state.result && initialAttemptsRemaining <= 0) {
    return (
      <div className="surface flex flex-col items-center gap-2 p-10 text-center">
        <XCircle className="h-12 w-12 text-destructive" />
        <h1 className="font-display text-2xl font-extrabold text-foreground">Sin intentos disponibles</h1>
        <p className="text-sm text-muted-foreground">
          Ya usaste tus {maxAttempts} intentos para este cuestionario sin alcanzar el mínimo de {passingScore}%.
        </p>
        <Link href={`/aula/${courseId}`} className={cn(buttonVariants({ variant: "outline" }), "mt-2")}>
          Volver al aula
        </Link>
      </div>
    );
  }

  if (state.result) {
    const { score, passed, attemptsRemaining, feedback } = state.result;
    const feedbackByQuestion = new Map(feedback?.map((f) => [f.questionId, f]) ?? []);

    return (
      <div className="space-y-6">
        <div
          className={cn(
            "surface flex flex-col items-center gap-2 p-8 text-center",
            passed ? "surface-accent-top" : ""
          )}
        >
          {passed ? (
            <CheckCircle2 className="h-12 w-12 text-success" />
          ) : (
            <XCircle className="h-12 w-12 text-destructive" />
          )}
          <h2 className="font-display text-2xl font-extrabold text-foreground">
            {passed ? "¡Cuestionario aprobado!" : "No alcanzaste el puntaje mínimo"}
          </h2>
          <p className="text-sm text-muted-foreground">
            Obtuviste <span className="font-semibold text-foreground">{score}%</span> (mínimo {passingScore}%).
          </p>
          {!passed && (
            <p className="text-sm text-muted-foreground">
              {attemptsRemaining > 0
                ? `Te ${attemptsRemaining === 1 ? "queda" : "quedan"} ${attemptsRemaining} ${attemptsRemaining === 1 ? "intento" : "intentos"}.`
                : "Ya no te quedan intentos disponibles para este cuestionario."}
            </p>
          )}
        </div>

        {feedback && (
          <div className="space-y-3">
            {questions.map((question, index) => {
              const f = feedbackByQuestion.get(question.id);
              if (!f) return null;
              return (
                <div key={question.id} className="surface space-y-2 p-4">
                  <div className="flex items-start gap-2">
                    {f.isCorrect ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    ) : (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    )}
                    <p className="text-sm font-medium text-foreground">
                      {index + 1}. {question.statement}
                    </p>
                  </div>
                  <ul className="ml-6 space-y-1 text-sm">
                    {question.options.map((option) => (
                      <li
                        key={option.id}
                        className={cn(
                          "rounded-md px-2 py-1",
                          f.correctOptionIds.includes(option.id)
                            ? "bg-success/10 text-success"
                            : "text-muted-foreground"
                        )}
                      >
                        {option.text}
                      </li>
                    ))}
                  </ul>
                  {f.explanation && <p className="ml-6 text-xs text-muted-foreground">{f.explanation}</p>}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Link href={`/aula/${courseId}`} className={buttonVariants({ variant: "outline" })}>
            Volver al aula
          </Link>
          {!passed && attemptsRemaining > 0 && (
            <Button type="button" onClick={() => window.location.reload()}>
              Reintentar
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-6">
      <div className="surface space-y-2 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="font-display text-2xl font-extrabold text-foreground">{title}</h1>
          {secondsLeft !== null && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/15 px-3 py-1 text-sm font-semibold text-warning-foreground">
              <Clock className="h-4 w-4" />
              {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
            </span>
          )}
        </div>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
        <p className="text-xs text-muted-foreground">
          Intento {attemptNumber} de {maxAttempts} · Puntaje mínimo para aprobar: {passingScore}%
        </p>
      </div>

      <div className="space-y-4">
        {questions.map((question, index) => (
          <fieldset key={question.id} className="surface space-y-3 p-5">
            <legend className="text-sm font-semibold text-foreground">
              {index + 1}. {question.statement}
            </legend>
            <div className="space-y-2">
              {question.options.map((option) => (
                <label
                  key={option.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted/50"
                >
                  <input
                    type={question.type === "MULTIPLE_CHOICE" ? "checkbox" : "radio"}
                    name={`q_${question.id}`}
                    value={option.id}
                    required={question.type !== "MULTIPLE_CHOICE"}
                    className="h-4 w-4"
                  />
                  <span className="text-foreground">{option.text}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>

      {state.error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
      )}

      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Enviando..." : "Enviar respuestas"}
      </Button>
    </form>
  );
}
