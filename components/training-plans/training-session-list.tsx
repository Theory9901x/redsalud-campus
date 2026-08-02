"use client";

import { useTransition } from "react";
import { CalendarClock, MapPin, Link2, Users, PlayCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeleteEntityButton } from "@/components/admin/delete-entity-button";
import {
  TRAINING_MODALITY_LABELS,
  SESSION_SHIFT_LABELS,
  TRAINING_ACTIVITY_STATUS_LABELS,
  TRAINING_ACTIVITY_STATUS_CLASSES,
  etiquetaJornada,
} from "@/components/training-plans/labels";
import type { TrainingActivityStatus, TrainingModality, SessionShift } from "@prisma/client";

type Sesion = {
  id: string;
  startsAt: Date;
  endsAt: Date | null;
  shift: SessionShift | null;
  modality: TrainingModality;
  location: string | null;
  meetingUrl: string | null;
  capacity: number | null;
  status: TrainingActivityStatus;
  municipio: { nombre: string } | null;
};

export function TrainingSessionList({
  sessions,
  onEnable,
  onClose,
  onDelete,
}: {
  sessions: Sesion[];
  onEnable: (sessionId: string) => Promise<void>;
  onClose: (sessionId: string) => Promise<void>;
  onDelete: (sessionId: string) => Promise<{ error: string | null }>;
}) {
  const [pendiente, iniciar] = useTransition();

  if (sessions.length === 0) {
    return (
      <p className="surface p-4 text-sm text-muted-foreground">
        Todavía no hay jornadas agendadas. El plan la programa por trimestre; aquí se agenda el día exacto.
      </p>
    );
  }

  function ejecutar(fn: () => Promise<void>) {
    iniciar(async () => {
      try {
        await fn();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No se pudo actualizar la jornada.");
      }
    });
  }

  return (
    <div className="space-y-2.5">
      {sessions.map((s) => (
        <div key={s.id} className="surface flex flex-col gap-2.5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <CalendarClock className="h-4 w-4 text-primary" aria-hidden="true" />
                {etiquetaJornada(s)}
              </span>
              {s.shift && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                  {SESSION_SHIFT_LABELS[s.shift]}
                </span>
              )}
              <Badge className={TRAINING_ACTIVITY_STATUS_CLASSES[s.status]}>
                {TRAINING_ACTIVITY_STATUS_LABELS[s.status]}
              </Badge>
            </div>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>{TRAINING_MODALITY_LABELS[s.modality]}</span>
              {(s.location || s.municipio) && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" aria-hidden="true" />
                  {[s.location, s.municipio?.nombre].filter(Boolean).join(" · ")}
                </span>
              )}
              {s.meetingUrl && (
                <a href={s.meetingUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                  <Link2 className="h-3 w-3" aria-hidden="true" />
                  Enlace
                </a>
              )}
              {s.capacity && (
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" aria-hidden="true" />
                  Cupo: {s.capacity}
                </span>
              )}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {s.status === "DRAFT" && (
              <Button type="button" size="sm" variant="outline" disabled={pendiente} onClick={() => ejecutar(() => onEnable(s.id))} className="gap-1.5">
                <PlayCircle className="h-3.5 w-3.5" aria-hidden="true" />
                Habilitar
              </Button>
            )}
            {s.status === "OPEN" && (
              <Button type="button" size="sm" variant="outline" disabled={pendiente} onClick={() => ejecutar(() => onClose(s.id))} className="gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                Cerrar
              </Button>
            )}
            <DeleteEntityButton
              action={() => onDelete(s.id)}
              nombre="La jornada"
              descripcion="Se elimina esta jornada del calendario. La capacitación en el plan sigue existiendo."
              size="icon-sm"
            />
          </div>
        </div>
      ))}
    </div>
  );
}
