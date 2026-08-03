"use client";

import { useActionState, useState } from "react";
import { CalendarPlus, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TRAINING_MODALITY_LABELS, SESSION_SHIFT_LABELS } from "@/components/training-plans/labels";
import type { TrainingSessionFormState } from "@/app/admin/planes-capacitacion/actions";
import type { TrainingModality } from "@prisma/client";

const INICIAL: TrainingSessionFormState = { error: null };

/**
 * Agenda UNA jornada real: el día en que esta capacitación se dicta de
 * verdad, distinto del trimestre que trae el plan. Se puede llamar varias
 * veces sobre la misma capacitación -una por cada vez que se dicta-, así
 * que siempre agrega, nunca reemplaza lo que ya hay.
 */
export function TrainingSessionForm({
  action,
  municipios,
}: {
  action: (state: TrainingSessionFormState, formData: FormData) => Promise<TrainingSessionFormState>;
  municipios: { id: string; nombre: string }[];
}) {
  const [state, formAction, pendiente] = useActionState(action, INICIAL);
  const [modalidad, setModalidad] = useState<TrainingModality>("VIRTUAL");
  const mostrarLugar = modalidad === "PRESENCIAL" || modalidad === "MIXTA";
  const mostrarEnlace = modalidad === "VIRTUAL" || modalidad === "MIXTA";

  return (
    <form action={formAction} className="space-y-4">
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

      <div className="space-y-1.5">
        <Label htmlFor="modality">Modalidad</Label>
        <select
          id="modality"
          name="modality"
          value={modalidad}
          onChange={(e) => setModalidad(e.target.value as TrainingModality)}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          {Object.entries(TRAINING_MODALITY_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
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
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="meetingUrl">Enlace de la reunión</Label>
            {/*
              Meet no permite crear salas desde otra plataforma sin OAuth de
              Google: lo más cerca posible de "generar el enlace" sin
              credenciales es abrir meet.google.com/new -Google crea la sala
              al instante- y pegar aquí lo que resulte. Un solo viaje.
            */}
            <a
              href="https://meet.google.com/new"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              <Video className="h-3.5 w-3.5" aria-hidden="true" />
              Generar en Meet
            </a>
          </div>
          <Input id="meetingUrl" name="meetingUrl" type="url" placeholder="https://meet.google.com/…" />
          <p className="text-xs text-muted-foreground">
            «Generar en Meet» abre Google Meet con una sala nueva; copia su enlace y pégalo aquí. Los estudiantes
            verán el botón «Ingresar a la sesión» en su cronograma.
          </p>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="capacity">Cupo (opcional)</Label>
        <Input id="capacity" name="capacity" type="number" min={1} placeholder="Sin límite" />
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pendiente} className="w-full gap-1.5">
        <CalendarPlus className="h-4 w-4" aria-hidden="true" />
        {pendiente ? "Agendando…" : "Agendar jornada"}
      </Button>
    </form>
  );
}
