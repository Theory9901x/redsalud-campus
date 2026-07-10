"use client";

import { useActionState } from "react";
import { ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { COURSE_AUDIENCE_LABELS } from "@/components/cursos/labels";
import type { SurveyFormState } from "@/app/admin/planes-capacitacion/survey-actions";

const initialState: SurveyFormState = { error: null };

export function SurveyForm({
  action,
  defaultTargetDepartment,
  defaultTargetAudience,
  scopeLabel,
}: {
  action: (prevState: SurveyFormState, formData: FormData) => Promise<SurveyFormState>;
  defaultTargetDepartment: string | null;
  defaultTargetAudience: "ADMINISTRATIVO" | "ASISTENCIAL" | "AMBOS";
  /** Explica a quién queda asignada por defecto (plan completo o solo la actividad). */
  scopeLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-6">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <ClipboardList className="h-4 w-4 text-primary" />
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">Nueva encuesta</h2>
      </div>

      <p className="text-xs text-muted-foreground">{scopeLabel}</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="survey-title">Título</Label>
          <Input id="survey-title" name="title" required placeholder="Ej: Evaluación de la jornada" />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="survey-description">Descripción (opcional)</Label>
          <Textarea id="survey-description" name="description" rows={2} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="survey-department">Dependencia objetivo</Label>
          <Input
            id="survey-department"
            name="targetDepartment"
            placeholder="Vacío = todo el personal"
            defaultValue={defaultTargetDepartment ?? ""}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="survey-audience">Dirigido a</Label>
          <select
            id="survey-audience"
            name="targetAudience"
            required
            defaultValue={defaultTargetAudience}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            {Object.entries(COURSE_AUDIENCE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {state.error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Creando..." : "Crear encuesta"}
      </Button>
    </form>
  );
}
