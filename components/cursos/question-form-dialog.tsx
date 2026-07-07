"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { QUESTION_TYPE_LABELS } from "@/components/cursos/labels";
import type { QuizFormState } from "@/app/admin/cursos/quiz-actions";
import type { QuestionType } from "@prisma/client";

const initialState: QuizFormState = { error: null };

type OptionDraft = { text: string; isCorrect: boolean };

const TRUE_FALSE_OPTIONS: OptionDraft[] = [
  { text: "Verdadero", isCorrect: true },
  { text: "Falso", isCorrect: false },
];

const EMPTY_OPTIONS: OptionDraft[] = [
  { text: "", isCorrect: false },
  { text: "", isCorrect: false },
];

export function QuestionFormDialog({
  mode,
  action,
  defaultValues,
  trigger,
}: {
  mode: "create" | "edit";
  action: (prevState: QuizFormState, formData: FormData) => Promise<QuizFormState>;
  defaultValues?: {
    type: QuestionType;
    statement: string;
    score: number;
    explanation: string;
    options: OptionDraft[];
  };
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [type, setType] = useState<QuestionType>(defaultValues?.type ?? "SINGLE_CHOICE");
  const [options, setOptions] = useState<OptionDraft[]>(
    defaultValues?.options ?? (defaultValues?.type === "TRUE_FALSE" ? TRUE_FALSE_OPTIONS : EMPTY_OPTIONS)
  );

  useEffect(() => {
    if (state.success) setOpen(false);
  }, [state]);

  function handleTypeChange(nextType: QuestionType) {
    setType(nextType);
    if (nextType === "TRUE_FALSE") {
      setOptions(TRUE_FALSE_OPTIONS);
    } else if (type === "TRUE_FALSE") {
      setOptions(EMPTY_OPTIONS);
    }
  }

  function updateOptionText(index: number, text: string) {
    setOptions((prev) => prev.map((o, i) => (i === index ? { ...o, text } : o)));
  }

  function toggleCorrect(index: number) {
    setOptions((prev) => {
      if (type === "MULTIPLE_CHOICE") {
        return prev.map((o, i) => (i === index ? { ...o, isCorrect: !o.isCorrect } : o));
      }
      // Selección única / verdadero-falso: solo una opción correcta a la vez.
      return prev.map((o, i) => ({ ...o, isCorrect: i === index }));
    });
  }

  function addOption() {
    setOptions((prev) => [...prev, { text: "", isCorrect: false }]);
  }

  function removeOption(index: number) {
    setOptions((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <>
      <span onClick={() => setOpen(true)}>{trigger}</span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "Nueva pregunta" : "Editar pregunta"}</DialogTitle>
            <DialogDescription>Marca la o las opciones correctas. Nunca se muestran al estudiante antes de responder.</DialogDescription>
          </DialogHeader>
          <form action={formAction} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="type">Tipo de pregunta</Label>
              <select
                id="type"
                name="type"
                value={type}
                onChange={(e) => handleTypeChange(e.target.value as QuestionType)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                {Object.entries(QUESTION_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="statement">Enunciado</Label>
              <Textarea id="statement" name="statement" rows={2} required defaultValue={defaultValues?.statement} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="score">Puntaje</Label>
                <Input id="score" name="score" type="number" min={1} max={100} required defaultValue={defaultValues?.score ?? 1} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="explanation">Retroalimentación (opcional)</Label>
              <Textarea
                id="explanation"
                name="explanation"
                rows={2}
                placeholder="Se muestra al estudiante después de responder, si el cuestionario lo permite."
                defaultValue={defaultValues?.explanation}
              />
            </div>

            <div className="space-y-2">
              <Label>Opciones</Label>
              <div className="space-y-2">
                {options.map((option, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type={type === "MULTIPLE_CHOICE" ? "checkbox" : "radio"}
                      name={type === "MULTIPLE_CHOICE" ? undefined : "correctRadio"}
                      checked={option.isCorrect}
                      onChange={() => toggleCorrect(index)}
                      className="h-4 w-4 shrink-0"
                      aria-label="Marcar como correcta"
                    />
                    <Input
                      value={option.text}
                      onChange={(e) => updateOptionText(index, e.target.value)}
                      placeholder={`Opción ${index + 1}`}
                      readOnly={type === "TRUE_FALSE"}
                      required
                      className="flex-1"
                    />
                    {type !== "TRUE_FALSE" && options.length > 2 && (
                      <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeOption(index)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              {type !== "TRUE_FALSE" && (
                <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addOption}>
                  <Plus className="h-4 w-4" />
                  Añadir opción
                </Button>
              )}
            </div>

            <input type="hidden" name="optionsJson" value={JSON.stringify(options)} />

            {state.error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
            )}
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending ? "Guardando..." : "Guardar pregunta"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
