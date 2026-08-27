"use client";

import { useActionState, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { PanelEnLinea, PieFormulario } from "@/components/cursos/panel-en-linea";
import type { QuizFormState } from "@/app/admin/cursos/quiz-actions";
import { useAlTenerExito } from "@/lib/use-exito-accion";

const initialState: QuizFormState = { error: null };

/**
 * Formulario de cuestionario EN LÍNEA (el nombre "Dialog" es histórico: se
 * despliega dentro del módulo, debajo del disparador).
 */
export function QuizFormDialog({
  mode,
  action,
  moduleId,
  contextLabel,
  defaultValues,
  trigger,
}: {
  mode: "create" | "edit";
  action: (prevState: QuizFormState, formData: FormData) => Promise<QuizFormState>;
  /** Módulo al que queda fijo el cuestionario, o null para la evaluación final del curso. */
  moduleId: string | null;
  contextLabel: string;
  defaultValues?: {
    title: string;
    description: string;
    passingScore: number;
    maxAttempts: number;
    timeLimitMinutes: number | null;
    randomizeQuestions: boolean;
    randomizeAnswers: boolean;
    showResultsNow: boolean;
  };
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, initialState);

  useAlTenerExito(state, () => setOpen(false));

  return (
    <>
      <span onClick={() => setOpen((v) => !v)}>{trigger}</span>
      {open && (
        <PanelEnLinea
          titulo={mode === "create" ? "Nuevo cuestionario" : "Editar cuestionario"}
          descripcion={contextLabel}
          onCerrar={() => setOpen(false)}
        >
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="moduleId" value={moduleId ?? ""} />
            <div className="space-y-1.5">
              <Label htmlFor="quiz-title">Título</Label>
              <Input id="quiz-title" name="title" required defaultValue={defaultValues?.title} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quiz-description">Descripción</Label>
              <Textarea id="quiz-description" name="description" rows={2} defaultValue={defaultValues?.description} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="passingScore">Puntaje mínimo (%)</Label>
                <Input
                  id="passingScore"
                  name="passingScore"
                  type="number"
                  min={1}
                  max={100}
                  required
                  defaultValue={defaultValues?.passingScore ?? 60}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="maxAttempts">Intentos máximos</Label>
                <Input
                  id="maxAttempts"
                  name="maxAttempts"
                  type="number"
                  min={1}
                  max={10}
                  required
                  defaultValue={defaultValues?.maxAttempts ?? 10}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="timeLimitMinutes">Tiempo límite (min, opcional)</Label>
                <Input
                  id="timeLimitMinutes"
                  name="timeLimitMinutes"
                  type="number"
                  min={1}
                  defaultValue={defaultValues?.timeLimitMinutes ?? ""}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="flex items-center gap-3">
                <Switch
                  id="randomizeQuestions"
                  name="randomizeQuestions"
                  defaultChecked={defaultValues?.randomizeQuestions ?? false}
                />
                <Label htmlFor="randomizeQuestions" className="font-normal">
                  Orden aleatorio de preguntas
                </Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  id="randomizeAnswers"
                  name="randomizeAnswers"
                  defaultChecked={defaultValues?.randomizeAnswers ?? false}
                />
                <Label htmlFor="randomizeAnswers" className="font-normal">
                  Orden aleatorio de opciones
                </Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  id="showResultsNow"
                  name="showResultsNow"
                  defaultChecked={defaultValues?.showResultsNow ?? true}
                />
                <Label htmlFor="showResultsNow" className="font-normal">
                  Retroalimentación al finalizar
                </Label>
              </div>
            </div>
            {state.error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
            )}
            <PieFormulario pending={pending} etiqueta="Guardar cuestionario" onCancelar={() => setOpen(false)} />
          </form>
        </PanelEnLinea>
      )}
    </>
  );
}
