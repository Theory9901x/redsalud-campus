"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Award, CheckCircle2, Clock, FileText, XCircle } from "lucide-react";
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
  imageUrl?: string | null;
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
  const router = useRouter();
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

  // Este cuestionario era lo último que faltaba para completar el curso: en
  // vez del panel genérico de "aprobado", el momento real es la revelación
  // del certificado -se navega ahí en cuanto el resultado llega, no se
  // muestra primero un panel para reemplazarlo un instante después-.
  const certificateId = state.result?.certificateId;
  useEffect(() => {
    if (certificateId) router.push(`/mi-aula/certificados/${certificateId}?justIssued=1`);
  }, [certificateId, router]);

  if (certificateId) {
    return (
      <div className="surface flex flex-col items-center gap-3 p-10 text-center">
        <Award className="h-10 w-10 animate-pulse text-warning" />
        <p className="text-sm font-medium text-muted-foreground">Preparando tu certificado...</p>
      </div>
    );
  }

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
                    {f.isOpen ? (
                      <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : f.isCorrect ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    ) : (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    )}
                    <p className="text-sm font-medium text-foreground">
                      {index + 1}. {question.statement}
                    </p>
                  </div>
                  {question.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={question.imageUrl}
                      alt="Imagen de apoyo del enunciado"
                      className="ml-6 max-h-56 w-auto rounded-lg border border-border object-contain"
                    />
                  )}
                  {f.isOpen ? (
                    // Respuesta abierta: se muestra lo que escribió + la referencia.
                    <div className="ml-6 space-y-2 text-sm">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tu respuesta</p>
                        <p className="mt-0.5 whitespace-pre-line rounded-md bg-muted/50 px-2 py-1.5 text-foreground">
                          {f.textAnswer?.trim() ? f.textAnswer : "—"}
                        </p>
                      </div>
                      {f.explanation && (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-success">Respuesta de referencia</p>
                          <p className="mt-0.5 whitespace-pre-line rounded-md bg-success/10 px-2 py-1.5 text-foreground">
                            {f.explanation}
                          </p>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">Esta pregunta no cuenta al puntaje; se guarda para consulta.</p>
                    </div>
                  ) : (
                    <>
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
                    </>
                  )}
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
            {question.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={question.imageUrl}
                alt="Imagen de apoyo del enunciado"
                className="max-h-72 w-auto rounded-lg border border-border object-contain"
              />
            )}
            {question.type === "OPEN_TEXT" ? (
              <textarea
                name={`q_${question.id}_text`}
                rows={3}
                required
                placeholder="Escribe tu respuesta..."
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus-visible:border-[var(--accent)]/50 focus-visible:ring-2 focus-visible:ring-[var(--accent)]/15"
              />
            ) : (
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
            )}
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
