"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { COURSE_AUDIENCE_LABELS } from "@/components/cursos/labels";
import { TRAINING_ACTIVITY_TYPE_LABELS } from "@/components/training-plans/labels";
import type { TrainingActivityFormState } from "@/app/admin/planes-capacitacion/actions";
import type { TrainingActivityType } from "@prisma/client";

const initialState: TrainingActivityFormState = { error: null };

export function TrainingActivityForm({
  action,
  courses,
}: {
  action: (prevState: TrainingActivityFormState, formData: FormData) => Promise<TrainingActivityFormState>;
  courses: { id: string; title: string }[];
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [type, setType] = useState<TrainingActivityType>("COURSE");

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="activity-title">Título de la actividad</Label>
          <Input id="activity-title" name="title" required placeholder="Ej: Inducción institucional" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="activity-type">Tipo</Label>
          <select
            id="activity-type"
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value as TrainingActivityType)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            {Object.entries(TRAINING_ACTIVITY_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {type === "COURSE" ? (
          <div className="space-y-1.5">
            <Label htmlFor="activity-course">Curso vinculado</Label>
            <select
              id="activity-course"
              name="courseId"
              required
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Selecciona un curso</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground pt-6">
              Evento presencial: la asistencia se registra manualmente (Etapa 3).
            </p>
          </div>
        )}

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
        {pending ? "Agregando..." : "Agregar actividad"}
      </Button>
    </form>
  );
}
