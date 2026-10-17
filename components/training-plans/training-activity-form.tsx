"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { COURSE_AUDIENCE_LABELS } from "@/components/cursos/labels";
import type { TrainingActivityFormState } from "@/app/admin/planes-capacitacion/actions";

const initialState: TrainingActivityFormState = { error: null };

/**
 * Nueva capacitación del plan. Solo lo que la define en el plan: título,
 * fechas y a quién va dirigida. Su evaluación presaber / postsaber y sus
 * jornadas se arman después, dentro de la propia capacitación.
 */
export function TrainingActivityForm({
  action,
}: {
  action: (prevState: TrainingActivityFormState, formData: FormData) => Promise<TrainingActivityFormState>;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="type" value="COURSE" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="activity-title">Título de la capacitación</Label>
          <Input id="activity-title" name="title" required placeholder="Ej: Higiene de manos" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="activity-start">Fecha de inicio</Label>
          <Input id="activity-start" name="startDate" type="date" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="activity-end">Fecha de fin (opcional)</Label>
          <Input id="activity-end" name="endDate" type="date" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="activity-audience">Dirigido a</Label>
          <select
            id="activity-audience"
            name="targetAudience"
            required
            defaultValue="AMBOS"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            {Object.entries(COURSE_AUDIENCE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <Switch id="activity-required" name="isRequired" defaultChecked />
          <Label htmlFor="activity-required" className="font-normal">
            Obligatoria
          </Label>
        </div>
      </div>

      {state.error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
      )}

      <Button type="submit" disabled={pending} className="gap-1.5">
        <Plus className="h-4 w-4" />
        {pending ? "Agregando..." : "Agregar capacitación"}
      </Button>
    </form>
  );
}
