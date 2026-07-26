"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Award,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Clock,
  Lightbulb,
  ListChecks,
  NotebookPen,
  RefreshCw,
  Send,
  Target,
  X,
  XCircle,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { submitQuizAttemptAction, type QuizSubmitState } from "@/app/aula/[courseId]/quiz/[quizId]/actions";
import type { NotaRepasoItem } from "@/lib/aula";
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

/** Chip de metadato de la cabecera. */
function Chip({ icon: Icon, children }: { icon: typeof Target; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[12px] text-white/90 backdrop-blur">
      <Icon className="h-3.5 w-3.5" />
      {children}
    </span>
  );
}

/**
 * Nota de repaso: qué era lo correcto según el intento anterior fallido. Solo
 * llega al cliente cuando ya existe un intento calificado (ver getNotaRepaso).
 */
function NotaRepaso({ nota }: { nota: NotaRepasoItem[] }) {
  return (
    <details className="group surface-glass overflow-hidden border-warning/30 p-5">
      <summary className="flex cursor-pointer list-none items-center gap-2.5">
        <NotebookPen className="h-5 w-5 shrink-0 text-warning-foreground" />
        <span className="min-w-0 flex-1 text-[15px] font-semibold text-foreground">
          Nota de repaso — respuestas correctas del intento anterior
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-4 space-y-3">
        {nota.map((n) => (
          <div key={n.questionId} className="rounded-xl border border-border bg-card/60 p-4">
            <p className="break-words text-[13px] font-medium text-foreground">{n.statement}</p>
            {n.correctas.length > 0 &&
              n.correctas.map((texto) => (
                <p key={texto} className="mt-1.5 flex items-start gap-1.5 text-[13px] text-success">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span className="min-w-0 break-words">{texto}</span>
                </p>
              ))}
            {n.respuestaEsperada && (
              <p className="mt-1.5 break-words text-[13px] text-success">{n.respuestaEsperada}</p>
            )}
            {n.explanation && <p className="mt-1 break-words text-[12.5px] text-muted-foreground">{n.explanation}</p>}
          </div>
        ))}
      </div>
    </details>
  );
}

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
  notaRepaso = [],
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
  /** Respuestas correctas del intento anterior fallido (vacío en el primero). */
  notaRepaso?: NotaRepasoItem[];
}) {
  const router = useRouter();
  const action = submitQuizAttemptAction.bind(null, courseId, quizId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const [secondsLeft, setSecondsLeft] = useState(timeLimitMinutes ? timeLimitMinutes * 60 : null);
  // Contador de respondidas: habilita el envío solo cuando están todas.
  const [respondidas, setRespondidas] = useState(0);

  function recontar() {
    const form = formRef.current;
    if (!form) return;
    const contestadas = questions.filter((q) => {
      if (q.type === "OPEN_TEXT") {
        const ta = form.querySelector<HTMLTextAreaElement>(`[name="q_${q.id}_text"]`);
        return Boolean(ta?.value.trim());
      }
      return form.querySelectorAll(`[name="q_${q.id}"]:checked`).length > 0;
    }).length;
    setRespondidas(contestadas);
  }

  useEffect(() => {
    if (secondsLeft === null || state.result) return;
    if (secondsLeft <= 0) {
      formRef.current?.requestSubmit();
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((s) => (s === null ? null : s - 1)), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft, state.result]);

  // Este cuestionario era lo último que faltaba para completar el curso: en vez
  // del panel genérico de "aprobado", el momento real es la revelación del
  // certificado.
  const certificateId = state.result?.certificateId;
  useEffect(() => {
    if (certificateId) router.push(`/mi-aula/certificados/${certificateId}?justIssued=1`);
  }, [certificateId, router]);

  if (certificateId) {
    return (
      <div className="surface-glass flex flex-col items-center gap-3 p-10 text-center">
        <Award className="h-10 w-10 animate-pulse text-warning-foreground" />
        <p className="text-sm font-medium text-muted-foreground">Preparando tu certificado...</p>
      </div>
    );
  }

  // `state.result` (local) tiene prioridad sobre los props "initial*": enviar
  // dispara revalidatePath y el servidor devolvería initiallyPassed=true,
  // borrando la pantalla de resultado antes de que se lea.
  if (!state.result && initiallyPassed) {
    return (
      <div className="surface-glass flex flex-col items-center gap-2 p-10 text-center">
        <CheckCircle2 className="h-12 w-12 text-success" />
        <h1 className="font-display text-2xl font-extrabold text-foreground">Ya aprobaste esta evaluación</h1>
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
      <div className="space-y-5">
        <div className="surface-glass flex flex-col items-center gap-2 p-10 text-center">
          <XCircle className="h-12 w-12 text-destructive" />
          <h1 className="font-display text-2xl font-extrabold text-foreground">Sin intentos disponibles</h1>
          <p className="text-sm text-muted-foreground">
            Usaste tus {maxAttempts} intentos sin alcanzar el mínimo de {passingScore}%. Comunícate con Talento
            Humano.
          </p>
          <Link href={`/aula/${courseId}`} className={cn(buttonVariants({ variant: "outline" }), "mt-2")}>
            Volver al aula
          </Link>
        </div>
        {notaRepaso.length > 0 && <NotaRepaso nota={notaRepaso} />}
      </div>
    );
  }

  // ---------- Pantalla de resultado + revisión ----------
  if (state.result) {
    const { score, passed, attemptsRemaining, feedback } = state.result;
    const feedbackByQuestion = new Map(feedback?.map((f) => [f.questionId, f]) ?? []);

    return (
      <div className="space-y-5">
        <section
          className={cn(
            "relative overflow-hidden rounded-2xl border p-6 sm:p-7",
            passed ? "border-success/30" : "border-destructive/30"
          )}
          style={{
            backgroundImage: `linear-gradient(150deg, color-mix(in oklch, var(--${passed ? "success" : "destructive"}) 20%, var(--card)), var(--card))`,
          }}
        >
          <div className="flex flex-wrap items-center gap-4">
            <span
              className={cn(
                "grid h-16 w-16 shrink-0 place-items-center rounded-2xl",
                passed ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
              )}
            >
              {passed ? <CheckCircle2 className="h-8 w-8" /> : <XCircle className="h-8 w-8" />}
            </span>
            <div className="min-w-0">
              <h2 className="font-display text-[22px] font-extrabold text-foreground">
                {passed ? "¡Aprobaste!" : "No alcanzaste el mínimo"}
              </h2>
              <p className="text-[14px] text-muted-foreground">
                Obtuviste{" "}
                <b className={passed ? "text-success" : "text-destructive"}>{score}%</b> · Mínimo requerido:{" "}
                {passingScore}%
              </p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-[12px] text-muted-foreground">
                Intento {attemptNumber} de {maxAttempts}
              </p>
              {!passed && attemptsRemaining > 0 && (
                <p className="text-[12px] text-muted-foreground">
                  Te {attemptsRemaining === 1 ? "queda" : "quedan"} {attemptsRemaining}{" "}
                  {attemptsRemaining === 1 ? "intento" : "intentos"}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Revisión pregunta por pregunta. */}
        {feedback && (
          <div className="space-y-4">
            {questions.map((question, index) => {
              const f = feedbackByQuestion.get(question.id);
              if (!f) return null;
              const abierta = f.isOpen;
              return (
                <article key={question.id} className="surface-glass p-5 sm:p-6">
                  <div className="flex gap-3">
                    <span
                      className={cn(
                        "grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[13px] font-bold",
                        abierta
                          ? "bg-primary/15 text-primary"
                          : f.isCorrect
                            ? "bg-success/20 text-success"
                            : "bg-destructive/20 text-destructive"
                      )}
                    >
                      {abierta ? index + 1 : f.isCorrect ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                    </span>
                    <p className="min-w-0 flex-1 break-words text-[15px] font-semibold leading-relaxed text-foreground">
                      {question.statement}
                    </p>
                  </div>

                  <div className="mt-4 space-y-2.5 sm:pl-10">
                    {question.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={question.imageUrl}
                        alt="Imagen de apoyo del enunciado"
                        className="max-h-56 w-auto rounded-xl border border-border object-contain"
                      />
                    )}

                    {abierta ? (
                      <>
                        <div className="rounded-xl border border-border bg-card/60 p-4">
                          <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Tu respuesta
                          </p>
                          <p className="mt-1.5 break-words text-[14px] leading-relaxed text-foreground">
                            {f.textAnswer?.trim() || "— sin responder —"}
                          </p>
                        </div>
                        {f.expectedAnswer && (
                          <div className="rounded-xl border border-success/25 bg-success/5 p-4">
                            <p className="text-[12px] font-semibold uppercase tracking-wider text-success">
                              Respuesta esperada
                            </p>
                            <p className="mt-1.5 break-words text-[14px] leading-relaxed text-foreground">
                              {f.expectedAnswer}
                            </p>
                          </div>
                        )}
                        <p className="text-[12.5px] text-muted-foreground">
                          Las preguntas abiertas no suman al puntaje automático: las revisa Talento Humano.
                        </p>
                      </>
                    ) : (
                      question.options.map((option) => {
                        const esCorrecta = f.correctOptionIds.includes(option.id);
                        const esElegida = f.selectedOptionIds?.includes(option.id) ?? false;
                        return (
                          <div
                            key={option.id}
                            className={cn(
                              "flex items-center gap-3 rounded-xl border px-4 py-3 text-[14px]",
                              esCorrecta
                                ? "border-success/50 bg-success/10 text-foreground"
                                : esElegida
                                  ? "border-destructive/50 bg-destructive/10 text-foreground"
                                  : "border-border bg-card/40 text-muted-foreground"
                            )}
                          >
                            {esCorrecta ? (
                              <Check className="h-4 w-4 shrink-0 text-success" />
                            ) : esElegida ? (
                              <X className="h-4 w-4 shrink-0 text-destructive" />
                            ) : (
                              <span className="h-4 w-4 shrink-0" />
                            )}
                            <span className="min-w-0 break-words">{option.text}</span>
                            {esCorrecta && (
                              <span className="ml-auto shrink-0 text-[11px] font-semibold text-success">Correcta</span>
                            )}
                            {esElegida && !esCorrecta && (
                              <span className="ml-auto shrink-0 text-[11px] font-semibold text-destructive">
                                Tu respuesta
                              </span>
                            )}
                          </div>
                        );
                      })
                    )}

                    {f.explanation && (
                      <div className="flex gap-2 rounded-xl border border-primary/25 bg-primary/5 p-3.5">
                        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <p className="min-w-0 break-words text-[13px] leading-relaxed text-foreground/90">
                          {f.explanation}
                        </p>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Link href={`/aula/${courseId}`} className={buttonVariants({ variant: "outline" })}>
            Volver al aula
          </Link>
          {!passed && attemptsRemaining > 0 && (
            <Button type="button" onClick={() => window.location.reload()} className="gap-1.5">
              Reintentar evaluación <RefreshCw className="h-4 w-4" />
            </Button>
          )}
          {!passed && attemptsRemaining <= 0 && (
            <p className="text-sm text-destructive">Has agotado tus intentos. Comunícate con Talento Humano.</p>
          )}
        </div>
      </div>
    );
  }

  // ---------- Formulario del intento ----------
  return (
    <form ref={formRef} action={formAction} onChange={recontar} onInput={recontar} className="space-y-5">
      {/* Cabecera */}
      <section className="hud-hero noise-overlay accent-student relative overflow-hidden p-6 sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[var(--accent)]/25 blur-[90px]" />
        <div className="relative">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="chip-glass">
              <ClipboardCheck className="h-3.5 w-3.5 text-[var(--accent)]" />
              Evaluación final
            </span>
            {secondsLeft !== null && (
              <span className="chip-glass">
                <Clock className="h-3.5 w-3.5" />
                {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
              </span>
            )}
          </div>
          <h1 className="mt-4 font-display text-2xl font-extrabold tracking-tight text-white">{title}</h1>
          {description && (
            <p className="mt-2 max-w-[560px] break-words text-[13px] leading-relaxed text-white/70">{description}</p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <Chip icon={RefreshCw}>
              Intento {attemptNumber} de {maxAttempts}
            </Chip>
            <Chip icon={Target}>Mínimo para aprobar: {passingScore}%</Chip>
            <Chip icon={ListChecks}>{questions.length} preguntas</Chip>
          </div>
        </div>
      </section>

      {notaRepaso.length > 0 && <NotaRepaso nota={notaRepaso} />}

      {/* Preguntas */}
      {questions.map((question, index) => (
        <article key={question.id} className="surface-glass p-5 sm:p-6">
          <div className="flex gap-3">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[var(--accent)]/15 text-[13px] font-bold text-[var(--accent)]">
              {index + 1}
            </span>
            <p className="min-w-0 flex-1 break-words text-[15px] font-semibold leading-relaxed text-foreground">
              {question.statement}
            </p>
          </div>

          <div className="mt-4 sm:pl-10">
            {question.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={question.imageUrl}
                alt="Imagen de apoyo del enunciado"
                className="mb-3 max-h-72 w-auto rounded-xl border border-border object-contain"
              />
            )}

            {question.type === "OPEN_TEXT" ? (
              <textarea
                name={`q_${question.id}_text`}
                rows={4}
                placeholder="Escribe tu respuesta..."
                className="w-full resize-y rounded-xl border border-border bg-card/50 p-4 text-[14px] leading-relaxed text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-[var(--accent)]/50 focus-visible:ring-2 focus-visible:ring-[var(--accent)]/15"
              />
            ) : (
              <div className="space-y-2.5">
                {question.options.map((option) => (
                  <label
                    key={option.id}
                    className="group flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-card/40 px-4 py-3.5 transition-colors hover:border-[var(--accent)]/40 has-[:checked]:border-[var(--accent)]/60 has-[:checked]:bg-[var(--accent)]/10"
                  >
                    <span
                      className={cn(
                        "relative grid h-4 w-4 shrink-0 place-items-center border-2 border-muted-foreground/40 transition-colors group-has-[:checked]:border-[var(--accent)]",
                        question.type === "MULTIPLE_CHOICE" ? "rounded" : "rounded-full"
                      )}
                    >
                      <span
                        className={cn(
                          "h-2 w-2 scale-0 bg-[var(--accent)] transition-transform group-has-[:checked]:scale-100",
                          question.type === "MULTIPLE_CHOICE" ? "rounded-[2px]" : "rounded-full"
                        )}
                      />
                    </span>
                    <input
                      type={question.type === "MULTIPLE_CHOICE" ? "checkbox" : "radio"}
                      name={`q_${question.id}`}
                      value={option.id}
                      className="sr-only"
                    />
                    <span className="min-w-0 break-words text-[14px] text-foreground">{option.text}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </article>
      ))}

      {state.error && (
        <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{state.error}</p>
      )}

      {/* Pie de acciones, pegado abajo. */}
      <div className="surface-glass sticky bottom-4 flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <p className="text-[12.5px] text-muted-foreground">
          {respondidas}/{questions.length} respondidas
        </p>
        <Button type="submit" disabled={pending || respondidas < questions.length} className="gap-2 px-6">
          {pending ? "Enviando..." : "Enviar evaluación"}
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}
