"use client";

import { useTransition } from "react";
import { MapPin, Link2, Users, PlayCircle, CheckCircle2, Radio, Clock3 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeleteEntityButton } from "@/components/admin/delete-entity-button";
import { cn } from "@/lib/utils";
import {
  TRAINING_MODALITY_LABELS,
  SESSION_SHIFT_LABELS,
  TRAINING_ACTIVITY_STATUS_LABELS,
  TRAINING_ACTIVITY_STATUS_CLASSES,
} from "@/components/training-plans/labels";
import type { TrainingActivityStatus, TrainingModality, SessionShift } from "@prisma/client";

type Sesion = {
  id: string;
  /**
   * Etiquetas YA formateadas en el servidor. Formatear con Intl aquí -en un
   * componente de cliente- hidrata distinto de como renderizó el servidor
   * (el ICU del navegador mete espacios distintos en "a. m.") y React lo
   * marca como mismatch. Tercera vez que este módulo pisa esta mina; la
   * regla es una: las fechas se formatean donde se renderiza primero.
   */
  etiqueta: string;
  /** Ficha de calendario: { dia: "2", mes: "sep", anio: "2026" }. */
  ficha: { dia: string; mes: string; anio: string };
  /** "11:00 a. m. – 1:00 p. m." */
  horario: string;
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
  vivoBaseUrl,
}: {
  sessions: Sesion[];
  onEnable: (sessionId: string) => Promise<void>;
  onClose: (sessionId: string) => Promise<void>;
  onDelete: (sessionId: string) => Promise<{ error: string | null }>;
  /** FASE 10: base de la vista de gestión de la jornada ("{basePath}/{plan}/actividades/{actividad}/sesion"). */
  vivoBaseUrl?: string;
}) {
  const [pendiente, iniciar] = useTransition();

  if (sessions.length === 0) {
    return (
      <p className="surface p-5 text-sm leading-relaxed text-muted-foreground">
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
    <div className="space-y-3">
      {sessions.map((s) => {
        const cerrada = s.status === "CLOSED";
        return (
          <div
            key={s.id}
            className="surface group/fila flex flex-col gap-4 p-5 transition-all duration-200 hover:-translate-y-px hover:shadow-md lg:flex-row lg:items-center"
          >
            {/* Ficha de calendario: el día manda la fila. */}
            <Link
              href={vivoBaseUrl ? `${vivoBaseUrl}/${s.id}` : "#"}
              className={cn(
                "flex w-16 shrink-0 flex-col items-center justify-center self-start rounded-2xl border py-2.5 transition-colors lg:self-center",
                cerrada
                  ? "border-border/60 bg-muted/40 text-muted-foreground"
                  : "border-primary/25 bg-primary/8 text-primary group-hover/fila:border-primary/45"
              )}
              aria-label={`Gestión de la jornada del ${s.etiqueta}`}
            >
              <span className="text-[9.5px] font-extrabold uppercase tracking-[0.18em]">{s.ficha.mes}</span>
              <span className="font-display text-[1.6rem] font-extrabold leading-none tabular-nums">{s.ficha.dia}</span>
              <span className="mt-0.5 text-[9.5px] font-semibold tabular-nums opacity-70">{s.ficha.anio}</span>
            </Link>

            {/* Qué jornada es y dónde ocurre. */}
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                {vivoBaseUrl ? (
                  <Link
                    href={`${vivoBaseUrl}/${s.id}`}
                    className="flex items-center gap-1.5 font-display text-[15px] font-bold text-foreground transition-colors hover:text-primary"
                  >
                    <Clock3 className="h-4 w-4 text-primary" aria-hidden="true" />
                    {s.horario}
                  </Link>
                ) : (
                  <span className="flex items-center gap-1.5 font-display text-[15px] font-bold text-foreground">
                    <Clock3 className="h-4 w-4 text-primary" aria-hidden="true" />
                    {s.horario}
                  </span>
                )}
                {s.shift && (
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary">
                    {SESSION_SHIFT_LABELS[s.shift]}
                  </span>
                )}
                <Badge className={TRAINING_ACTIVITY_STATUS_CLASSES[s.status]}>
                  {TRAINING_ACTIVITY_STATUS_LABELS[s.status]}
                </Badge>
              </div>
              <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-muted-foreground">
                <span className="font-semibold text-foreground/75">{TRAINING_MODALITY_LABELS[s.modality]}</span>
                {(s.location || s.municipio) && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                    {[s.location, s.municipio?.nombre].filter(Boolean).join(" · ")}
                  </span>
                )}
                {s.meetingUrl && (
                  <a
                    href={s.meetingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 font-semibold text-primary hover:underline"
                  >
                    <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Abrir sala virtual
                  </a>
                )}
                {s.capacity && (
                  <span className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" aria-hidden="true" />
                    Cupo: {s.capacity}
                  </span>
                )}
              </p>
            </div>

            {/* Acciones, separadas del contenido. */}
            <div className="flex shrink-0 items-center gap-2 border-t border-border/40 pt-3 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
              {vivoBaseUrl && (
                <Link
                  href={`${vivoBaseUrl}/${s.id}`}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary/10 px-3.5 text-[12.5px] font-bold text-primary transition-colors hover:bg-primary/15"
                >
                  <Radio className="h-3.5 w-3.5" aria-hidden="true" />
                  Gestión de la jornada
                </Link>
              )}
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
        );
      })}
    </div>
  );
}
