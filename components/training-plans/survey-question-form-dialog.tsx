"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
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
import { SURVEY_QUESTION_TYPE_LABELS } from "@/components/training-plans/survey-labels";
import type { SurveyQuestionFormState } from "@/app/admin/planes-capacitacion/survey-actions";
import type { SurveyQuestionType } from "@prisma/client";

const initialState: SurveyQuestionFormState = { error: null };

const EMPTY_OPTIONS = [{ text: "" }, { text: "" }];

export function SurveyQuestionFormDialog({
  action,
  trigger,
}: {
  action: (prevState: SurveyQuestionFormState, formData: FormData) => Promise<SurveyQuestionFormState>;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [type, setType] = useState<SurveyQuestionType>("SINGLE_CHOICE");
  const [options, setOptions] = useState<{ text: string }[]>(EMPTY_OPTIONS);

  useEffect(() => {
    if (state.success) {
      setOpen(false);
      setOptions(EMPTY_OPTIONS);
    }
  }, [state]);

  const isChoice = type === "SINGLE_CHOICE" || type === "MULTIPLE_CHOICE";

  function updateOptionText(index: number, text: string) {
    setOptions((prev) => prev.map((o, i) => (i === index ? { text } : o)));
  }

  function addOption() {
    setOptions((prev) => [...prev, { text: "" }]);
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
            <DialogTitle>Nueva pregunta</DialogTitle>
            <DialogDescription>
              Encuesta de opinión: sin respuesta correcta, sin nota. Se responde una sola vez por persona.
            </DialogDescription>
          </DialogHeader>
          <form action={formAction} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="survey-question-type">Tipo de pregunta</Label>
              <select
                id="survey-question-type"
                name="type"
                value={type}
                onChange={(e) => setType(e.target.value as SurveyQuestionType)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                {Object.entries(SURVEY_QUESTION_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="survey-question-statement">Enunciado</Label>
              <Textarea id="survey-question-statement" name="statement" rows={2} required />
            </div>

            {type === "SCALE" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="survey-question-scale-min">Mínimo</Label>
                  <Input id="survey-question-scale-min" name="scaleMin" type="number" defaultValue={1} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="survey-question-scale-max">Máximo</Label>
                  <Input id="survey-question-scale-max" name="scaleMax" type="number" defaultValue={5} />
                </div>
              </div>
            )}

            {isChoice && (
              <div className="space-y-2">
                <Label>Opciones</Label>
                <div className="space-y-2">
                  {options.map((option, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        value={option.text}
                        onChange={(e) => updateOptionText(index, e.target.value)}
                        placeholder={`Opción ${index + 1}`}
                        required
                        className="flex-1"
                      />
                      {options.length > 2 && (
                        <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeOption(index)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addOption}>
                  <Plus className="h-4 w-4" />
                  Añadir opción
                </Button>
                <input type="hidden" name="optionsJson" value={JSON.stringify(options)} />
              </div>
            )}

            <div className="flex items-center gap-3">
              <Switch id="survey-question-required" name="isRequired" defaultChecked />
              <Label htmlFor="survey-question-required" className="font-normal">
                Obligatoria
              </Label>
            </div>

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
