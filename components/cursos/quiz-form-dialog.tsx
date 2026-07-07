"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { QuizFormState } from "@/app/admin/cursos/quiz-actions";

const initialState: QuizFormState = { error: null };

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

  useEffect(() => {
    if (state.success) setOpen(false);
  }, [state]);

  return (
    <>
      <span onClick={() => setOpen(true)}>{trigger}</span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "Nuevo cuestionario" : "Editar cuestionario"}</DialogTitle>
            <DialogDescription>{contextLabel}</DialogDescription>
          </DialogHeader>
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="moduleId" value={moduleId ?? ""} />
            <div className="space-y-1.5">
              <Label htmlFor="title">Título</Label>
              <Input id="title" name="title" required defaultValue={defaultValues?.title} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Descripción</Label>
              <Textarea id="description" name="description" rows={2} defaultValue={defaultValues?.description} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="passingScore">Puntaje mínimo (%)</Label>
                <Input
                  id="passingScore"
                  name="passingScore"
                  type="number"
                  min={1}
                  max={100}
                  required
                  defaultValue={defaultValues?.passingScore ?? 80}
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
                  defaultValue={defaultValues?.maxAttempts ?? 2}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="timeLimitMinutes">Tiempo límite en minutos (opcional)</Label>
              <Input
                id="timeLimitMinutes"
                name="timeLimitMinutes"
                type="number"
                min={1}
                defaultValue={defaultValues?.timeLimitMinutes ?? ""}
              />
            </div>
            <div className="space-y-3">
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
                  Mostrar retroalimentación al finalizar
                </Label>
              </div>
            </div>
            {state.error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
            )}
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending ? "Guardando..." : "Guardar cuestionario"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
