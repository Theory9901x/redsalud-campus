"use client";

import { useActionState, useState } from "react";
import { CalendarPlus, CalendarRange, MapPin, Users, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { TRAINING_MODALITY_LABELS, SESSION_SHIFT_LABELS } from "@/components/training-plans/labels";
import type { TrainingSessionFormState } from "@/app/admin/planes-capacitacion/actions";
import type { TrainingModality } from "@prisma/client";

const INICIAL: TrainingSessionFormState = { error: null };

function Grupo({ Icono, titulo, children }: { Icono: React.ComponentType<{ className?: string }>; titulo: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3">
      <legend className="flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground">
        <Icono className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
        {titulo}
      </legend>
      {children}
    </fieldset>
  );
}

/**
 * Agenda UNA jornada real: el día en que esta capacitación se dicta de
 * verdad, distinto del trimestre que trae el plan. Se puede llamar varias
 * veces sobre la misma capacitación -una por cada vez que se dicta-, así
 * que siempre agrega, nunca reemplaza lo que ya hay.
 */
export function TrainingSessionForm({
  action,
  municipios,
  salaIntegradaUrl,
}: {
  action: (state: TrainingSessionFormState, formData: FormData) => Promise<TrainingSessionFormState>;
  municipios: { id: string; nombre: string }[];
  /** URL de la sala virtual embebida de ESTA capacitación (/sala/{actividad}); un clic la usa como enlace de la jornada. */
  salaIntegradaUrl?: string;
}) {
  const [state, formAction, pendiente] = useActionState(action, INICIAL);
  const [modalidad, setModalidad] = useState<TrainingModality>("VIRTUAL");
  // La sala integrada es el camino por defecto: el campo nace con ella.
  const [enlace, setEnlace] = useState(salaIntegradaUrl ?? "");
  const mostrarLugar = modalidad === "PRESENCIAL" || modalidad === "MIXTA";
  const mostrarEnlace = modalidad === "VIRTUAL" || modalidad === "MIXTA";

  return (
    <form action={formAction} className="space-y-6">
      <Grupo Icono={CalendarRange} titulo="Cuándo">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="startsAtDate">Fecha</Label>
            <Input id="startsAtDate" name="startsAtDate" type="date" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="shift">Jornada</Label>
            <select
              id="shift"
              name="shift"
              defaultValue=""
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Sin definir</option>
              {Object.entries(SESSION_SHIFT_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="startsAtTime">Hora de inicio</Label>
            <Input id="startsAtTime" name="startsAtTime" type="time" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="endsAtTime">Hora de fin (opcional)</Label>
            <Input id="endsAtTime" name="endsAtTime" type="time" />
          </div>
        </div>
      </Grupo>

      <div className="h-px bg-border/50" aria-hidden="true" />

      <Grupo Icono={Video} titulo="Modalidad">
        {/* Selector segmentado: la modalidad es UNA decisión visible, no una
            opción escondida en un desplegable, y de ella depende qué campos
            aparecen debajo. */}
        <input type="hidden" name="modality" value={modalidad} />
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted/60 p-1" role="radiogroup" aria-label="Modalidad">
          {(Object.entries(TRAINING_MODALITY_LABELS) as [TrainingModality, string][]).map(([v, l]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={modalidad === v}
              onClick={() => setModalidad(v)}
              className={cn(
                "rounded-lg px-2 py-1.5 text-[12.5px] font-bold transition-all",
                modalidad === v
                  ? "bg-card text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {l}
            </button>
          ))}
        </div>

        {mostrarLugar && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="location">Lugar / sala</Label>
              <Input id="location" name="location" placeholder="Ej. Auditorio principal" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="municipioId">Municipio</Label>
              <select
                id="municipioId"
                name="municipioId"
                defaultValue=""
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Sin especificar</option>
                {municipios.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {mostrarEnlace && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label htmlFor="meetingUrl">Enlace de la sesión virtual</Label>
              {salaIntegradaUrl && enlace !== salaIntegradaUrl && (
                <button
                  type="button"
                  onClick={() => setEnlace(salaIntegradaUrl)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-success hover:underline"
                >
                  <Video className="h-3.5 w-3.5" aria-hidden="true" />
                  Restaurar sala integrada
                </button>
              )}
            </div>
            <Input
              id="meetingUrl"
              name="meetingUrl"
              type="url"
              placeholder="https://…"
              value={enlace}
              onChange={(e) => setEnlace(e.target.value)}
            />
            <div className="flex items-start gap-2.5 rounded-xl border border-primary/20 bg-primary/6 px-3.5 py-3">
              <Video className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                La jornada usa la <b className="text-foreground/80">sala integrada de la plataforma</b>: registra
                asistencia automática, muestra quiénes están en la llamada y permite grabar la sesión. Solo cámbialo
                si ocurre en un espacio externo excepcional.
              </p>
            </div>
          </div>
        )}
      </Grupo>

      <div className="h-px bg-border/50" aria-hidden="true" />

      <Grupo Icono={Users} titulo="Aforo">
        <div className="space-y-1.5">
          <Label htmlFor="capacity">Cupo (opcional)</Label>
          <Input id="capacity" name="capacity" type="number" min={1} placeholder="Sin límite" />
        </div>
      </Grupo>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pendiente} className="w-full gap-1.5">
        <CalendarPlus className="h-4 w-4" aria-hidden="true" />
        {pendiente ? "Agendando…" : "Agendar jornada"}
      </Button>
    </form>
  );
}
