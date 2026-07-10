"use client";

import { useActionState } from "react";
import { CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { TrainingPlanFormState } from "@/app/admin/planes-capacitacion/actions";
import type { Role } from "@prisma/client";

const initialState: TrainingPlanFormState = { error: null };

export function TrainingPlanForm({
  action,
  tutors,
  departments,
  isAdmin,
}: {
  action: (prevState: TrainingPlanFormState, formData: FormData) => Promise<TrainingPlanFormState>;
  tutors: { id: string; fullName: string; role: Role }[];
  departments: string[];
  isAdmin: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const currentYear = new Date().getFullYear();

  return (
    <form action={formAction} className="space-y-6">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <CalendarRange className="h-4 w-4 text-primary" />
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">Datos del plan</h2>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="title">Título del plan</Label>
          <Input id="title" name="title" required placeholder="Plan de capacitación 2026 - Enfermería" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="year">Año</Label>
          <Input id="year" name="year" type="number" required defaultValue={currentYear} min={2000} max={2100} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="targetDepartment">Proceso / área objetivo</Label>
          <Input
            id="targetDepartment"
            name="targetDepartment"
            list="departamentos-existentes"
            placeholder="Ej: Enfermería (vacío = todo el personal)"
          />
          <datalist id="departamentos-existentes">
            {departments.map((dept) => (
              <option key={dept} value={dept} />
            ))}
          </datalist>
          <p className="text-xs text-muted-foreground">
            Déjalo vacío para dirigir el plan a todo el personal, sin importar el área.
          </p>
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="description">Descripción</Label>
          <Textarea id="description" name="description" rows={3} />
        </div>

        {isAdmin && (
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="tutorId">Tutor responsable</Label>
            <select
              id="tutorId"
              name="tutorId"
              required
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Selecciona un tutor</option>
              {tutors.map((tutor) => (
                <option key={tutor.id} value={tutor.id}>
                  {tutor.fullName} {tutor.role === "ADMIN" ? "(Admin)" : ""}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              El tutor elegido queda como responsable del plan; también puedes crearlo a tu propio nombre.
            </p>
          </div>
        )}
      </div>

      {state.error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Creando..." : "Crear plan"}
      </Button>
    </form>
  );
}
