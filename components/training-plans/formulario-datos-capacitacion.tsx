"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { EstadoDatosCapacitacion } from "@/app/admin/planes-capacitacion/evaluacion-acciones";

export type DatosCapacitacion = {
  title: string;
  quarters: number[];
  targetAudience: "ADMINISTRATIVO" | "ASISTENCIAL" | "AMBOS";
  modality: "VIRTUAL" | "PRESENCIAL" | "MIXTA";
  isRequired: boolean;
  areaId: string | null;
  objective: string;
};

const campo = "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-[15px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/60";
const etiqueta = "mb-1.5 block text-[14px] font-semibold text-foreground";

/**
 * Datos básicos de una capacitación, editables desde la propia capacitación:
 * nombre, trimestres, a quién va dirigida, modalidad, área, si es obligatoria
 * y el objetivo. Antes solo se podían fijar al crearla o al importar el plan.
 */
export function FormularioDatosCapacitacion({
  action,
  datos,
  areas,
  delPlan,
}: {
  action: (prev: EstadoDatosCapacitacion, fd: FormData) => Promise<EstadoDatosCapacitacion>;
  datos: DatosCapacitacion;
  areas: { id: string; name: string }[];
  /** Capacitación del plan institucional: lleva trimestres y área. Las independientes, no. */
  delPlan: boolean;
}) {
  const router = useRouter();
  const [estado, enviar, pendiente] = useActionState(action, { error: null });
  useEffect(() => {
    if (!estado.success) return;
    toast.success("Capacitación actualizada.");
    router.refresh();
  }, [estado, router]);

  return (
    <form action={enviar} className="space-y-5">
      <label className="block">
        <span className={etiqueta}>Nombre de la capacitación</span>
        <input name="title" required minLength={3} maxLength={300} defaultValue={datos.title} className={campo} />
      </label>

      {delPlan && (
        <fieldset>
          <legend className={etiqueta}>Trimestres en que se programa</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[1, 2, 3, 4].map((t) => (
              <label key={t} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-[14.5px] font-semibold has-[:checked]:border-primary has-[:checked]:bg-primary/10">
                <input type="checkbox" name="quarters" value={t} defaultChecked={datos.quarters.includes(t)} className="h-4 w-4" />
                Trimestre {["I", "II", "III", "IV"][t - 1]}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={etiqueta}>Dirigida a</span>
          <select name="targetAudience" defaultValue={datos.targetAudience} className={campo}>
            <option value="AMBOS">Todo el personal</option>
            <option value="ASISTENCIAL">Personal asistencial</option>
            <option value="ADMINISTRATIVO">Personal administrativo</option>
          </select>
        </label>
        <label className="block">
          <span className={etiqueta}>Modalidad</span>
          <select name="modality" defaultValue={datos.modality} className={campo}>
            <option value="VIRTUAL">Virtual</option>
            <option value="PRESENCIAL">Presencial</option>
            <option value="MIXTA">Mixta</option>
          </select>
        </label>
      </div>

      {delPlan && areas.length > 0 && (
        <label className="block">
          <span className={etiqueta}>Área responsable</span>
          <select name="areaId" defaultValue={datos.areaId ?? ""} className={campo}>
            <option value="">Sin área</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border px-3 py-2.5">
        <input type="checkbox" name="isRequired" defaultChecked={datos.isRequired} className="mt-0.5 h-4 w-4" />
        <span>
          <span className="block text-[14.5px] font-semibold text-foreground">Es obligatoria</span>
          <span className="block text-[13.5px] text-muted-foreground">Cuenta para la adherencia del personal al que va dirigida.</span>
        </span>
      </label>

      <label className="block">
        <span className={etiqueta}>
          Objetivo <span className="font-normal text-muted-foreground">(opcional)</span>
        </span>
        <textarea name="objective" rows={3} maxLength={2000} defaultValue={datos.objective} className={campo} />
      </label>

      {estado.error && (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-[14px] font-medium text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {estado.error}
        </p>
      )}

      <Button type="submit" disabled={pendiente} className="h-11 gap-2 px-5 text-[15px]">
        {pendiente ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
        Guardar cambios
      </Button>
    </form>
  );
}
