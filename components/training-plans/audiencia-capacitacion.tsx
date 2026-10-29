"use client";

import { useActionState } from "react";
import type { CourseAudience } from "@prisma/client";
import { guardarAudienciaCapacitacionAction } from "@/app/tutor/capacitaciones/actions";
import { Button } from "@/components/ui/button";

export function AudienciaCapacitacion({ activityId, audience, visible }: { activityId: string; audience: CourseAudience; visible: boolean }) {
  const [state, action, pending] = useActionState(guardarAudienciaCapacitacionAction.bind(null, activityId), { error: null });
  return <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
    <h2 className="text-xl font-semibold">Audiencia y publicación</h2>
    <p className="mt-1 text-base text-muted-foreground">El área decide a quién se le muestra esta capacitación en el campus.</p>
    <form action={action} className="mt-4 space-y-4">
      <label className="block space-y-2"><span className="block font-semibold">Personal al que va dirigida</span><select name="targetAudience" required defaultValue={audience} className="min-h-12 w-full rounded-lg border border-input bg-background px-3 text-base">
        <option value="ADMINISTRATIVO">Administrativos</option><option value="ASISTENCIAL">Asistenciales</option><option value="AMBOS">Ambos</option>
      </select></label>
      {!visible && <label className="flex items-center gap-3 text-base"><input type="checkbox" name="habilitar" className="h-5 w-5 accent-primary" /><span>Habilitar para el personal seleccionado</span></label>}
      {state.error && <p role="alert" className="text-destructive">{state.error}</p>}
      {state.ok && <p role="status" className="text-success">{state.ok}</p>}
      <Button type="submit" disabled={pending} className="min-h-11 text-base">{pending ? "Guardando…" : "Guardar y aplicar"}</Button>
    </form>
  </section>;
}
