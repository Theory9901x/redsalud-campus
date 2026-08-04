"use client";

import { useActionState } from "react";
import Link from "next/link";
import { CheckCircle2, XCircle, ArrowLeft, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { EvaluacionExternaState } from "@/app/invitado/[activityId]/actions";

const INICIAL: EvaluacionExternaState = { error: null };

export type PreguntaExterna = {
  id: string;
  statement: string;
  type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE";
  options: { id: string; text: string }[];
};

/**
 * Formulario de evaluación para INVITADOS externos: las mismas preguntas de
 * la evaluación del curso, en una versión simple de un solo envío (los
 * invitados tienen UN intento por momento). La calificación ocurre en el
 * servidor; aquí nunca llega qué opción es la correcta.
 */
export function EvaluacionExternaForm({
  action,
  preguntas,
  momentoLabel,
  volverHref,
}: {
  action: (state: EvaluacionExternaState, formData: FormData) => Promise<EvaluacionExternaState>;
  preguntas: PreguntaExterna[];
  momentoLabel: string;
  volverHref: string;
}) {
  const [state, formAction, pendiente] = useActionState(action, INICIAL);

  if (state.resultado) {
    const { score, passed, passingScore } = state.resultado;
    return (
      <div className="surface-glass surface-accent-top mx-auto w-full max-w-md p-8 text-center">
        <span
          className={cn(
            "mx-auto flex h-16 w-16 items-center justify-center rounded-full",
            passed ? "bg-success/15 text-success" : "bg-destructive/10 text-destructive"
          )}
        >
          {passed ? <CheckCircle2 className="h-8 w-8" /> : <XCircle className="h-8 w-8" />}
        </span>
        <h2 className="mt-4 font-display text-2xl font-extrabold text-foreground">Resultado: {score}%</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {passed
            ? `Aprobaste la evaluación (mínimo ${passingScore}%). Tu resultado quedó registrado para el informe de la jornada.`
            : `No alcanzaste el mínimo (${passingScore}%). Tu resultado quedó registrado para el informe de la jornada.`}
        </p>
        <Link href={volverHref} className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> Volver a la jornada
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {preguntas.map((q, i) => (
        <article key={q.id} className="surface-glass p-5">
          <div className="flex gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold leading-relaxed text-foreground">{q.statement}</p>
              <div className="mt-3 space-y-2">
                {q.options.map((o) => (
                  <label
                    key={o.id}
                    className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-card/60 px-4 py-2.5 text-sm text-foreground transition-colors hover:border-primary/40"
                  >
                    <input
                      type={q.type === "MULTIPLE_CHOICE" ? "checkbox" : "radio"}
                      name={`q_${q.id}`}
                      value={o.id}
                      className="h-4 w-4 accent-[var(--primary)]"
                    />
                    <span className="min-w-0">{o.text}</span>
                  </label>
                ))}
              </div>
              {q.type === "MULTIPLE_CHOICE" && (
                <p className="mt-1.5 text-[11px] text-muted-foreground">Selección múltiple: marca todas las que apliquen.</p>
              )}
            </div>
          </div>
        </article>
      ))}

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Un único intento para el {momentoLabel.toLowerCase()}. Revisa tus respuestas antes de enviar.
        </p>
        <Button type="submit" disabled={pendiente} className="gap-1.5">
          <Send className="h-4 w-4" aria-hidden="true" />
          {pendiente ? "Calificando…" : "Enviar respuestas"}
        </Button>
      </div>
    </form>
  );
}
