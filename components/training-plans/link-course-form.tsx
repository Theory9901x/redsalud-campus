"use client";

import { useActionState } from "react";
import { Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { LinkCourseState } from "@/app/admin/planes-capacitacion/actions";

const INICIAL: LinkCourseState = { error: null };

/**
 * Cómo un área convierte "sin contenido todavía" en una capacitación real:
 * elige, entre SUS cursos publicados, cuál es el que desarrolla esta línea
 * del plan.
 *
 * Sin lista de cursos no hay nada que vincular -pasa mientras el área
 * todavía no ha publicado ninguno-, así que el formulario ni se muestra: en
 * su lugar se dice qué hacer primero.
 */
export function LinkCourseForm({
  action,
  courses,
}: {
  action: (state: LinkCourseState, formData: FormData) => Promise<LinkCourseState>;
  courses: { id: string; title: string }[];
}) {
  const [state, formAction, pendiente] = useActionState(action, INICIAL);

  if (courses.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Todavía no tienes ningún curso publicado. Crea uno desde <strong>Mis cursos</strong> y vuelve aquí para
        vincularlo.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="min-w-[240px] flex-1 space-y-1.5">
        <Label htmlFor="courseId">Curso que desarrolla esta capacitación</Label>
        <select
          id="courseId"
          name="courseId"
          required
          defaultValue=""
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="" disabled>
            Elige un curso
          </option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" disabled={pendiente} className="gap-1.5">
        <Link2 className="h-4 w-4" aria-hidden="true" />
        {pendiente ? "Vinculando…" : "Vincular curso"}
      </Button>
      {state.error && <p className="w-full text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
