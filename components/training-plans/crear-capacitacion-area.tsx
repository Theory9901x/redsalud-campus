"use client";

import { useActionState } from "react";
import { crearCapacitacionAreaAction } from "@/app/tutor/capacitaciones/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CrearCapacitacionArea({ areas, planes, planInicial }: {
  areas: { id: string; name: string }[]; planes: { id: string; title: string }[]; planInicial?: string;
}) {
  const [state, action, pending] = useActionState(crearCapacitacionAreaAction, { error: null });
  const select = "h-12 w-full rounded-lg border border-input bg-background px-3 text-base";
  return <form action={action} className="space-y-6">
    <div className="grid gap-5 sm:grid-cols-2">
      <label className="space-y-2"><span className="block font-semibold">Tu área</span><select name="areaId" required className={select} defaultValue={areas[0]?.id ?? ""}><option value="" disabled>Selecciona tu área</option>{areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
      <label className="space-y-2"><span className="block font-semibold">Plan de capacitación</span><select name="planId" required className={select} defaultValue={planes.some(p => p.id === planInicial) ? planInicial : ""}><option value="" disabled>Selecciona un plan activo</option>{planes.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
    </div>
    <label className="block space-y-2"><span className="block font-semibold">Nombre de la capacitación</span><Input name="title" required minLength={5} className="h-12 text-base" placeholder="Ej. Seguridad de la información" /></label>
    <label className="block space-y-2"><span className="block font-semibold">Objetivo</span><textarea name="objective" required minLength={10} rows={4} className="w-full rounded-lg border border-input bg-background p-3 text-base" placeholder="¿Qué aprenderán los participantes?" /></label>
    <div className="grid gap-5 sm:grid-cols-2">
      <label className="space-y-2"><span className="block font-semibold">Modalidad</span><select name="modality" className={select}><option value="VIRTUAL">Virtual</option><option value="PRESENCIAL">Presencial</option><option value="MIXTA">Mixta</option></select></label>
      <label className="space-y-2"><span className="block font-semibold">Dirigida a</span><select name="targetAudience" className={select}><option value="AMBOS">Personal asistencial y administrativo</option><option value="ASISTENCIAL">Personal asistencial</option><option value="ADMINISTRATIVO">Personal administrativo</option></select></label>
    </div>
    <p className="text-sm leading-relaxed text-muted-foreground">La capacitación quedará en borrador dentro de tu área. Luego podrás agregar contenido, evaluación y jornadas desde su ficha.</p>
    {state.error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-destructive">{state.error}</p>}
    <Button type="submit" disabled={pending || !areas.length || !planes.length} className="min-h-12 w-full text-base">{pending ? "Creando…" : "Crear capacitación de mi área"}</Button>
    {(!areas.length || !planes.length) && <p className="text-sm text-muted-foreground">Se necesita un área asignada a tu cuenta y un plan activo para crear la capacitación.</p>}
  </form>;
}
