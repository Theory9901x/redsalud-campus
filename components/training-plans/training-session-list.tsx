"use client";

import { useTransition } from "react";
import { MapPin, Link2, Users, PlayCircle, CheckCircle2, Radio, Clock3, Video, UserCheck, FileQuestion, ClipboardCheck, UserPlus } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeleteEntityButton } from "@/components/admin/delete-entity-button";
import { AccesosJornada, type AccesoConQr } from "@/components/training-plans/accesos-jornada";
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
  /** Lo registrado por los enlaces de ESTA jornada. */
  conteo?: { asistentes: number; presaber: number; postsaber: number; invitados: number };
  /** Enlaces y QR propios de la jornada (puerta, sala, presaber, postsaber, invitados). */
  accesos?: AccesoConQr[];
  /** «Abrir sala» de esta jornada. */
  salaHref?: string;
  /** Cartel proyectable de la jornada. */
  fichaHref?: string;
  /** Es la jornada a la que llevan hoy los enlaces generales. */
  vigente?: boolean;
};

export function TrainingSessionList({
  sessions,
  onEnable,
  onClose,
  onDelete,
  vivoBaseUrl,
  conEvaluacion = false,
  independiente = false,
}: {
  sessions: Sesion[];
  onEnable: (sessionId: string) => Promise<void>;
  onClose: (sessionId: string) => Promise<void>;
  onDelete: (sessionId: string) => Promise<{ error: string | null }>;
  /** FASE 10: base de la vista de gestión de la jornada ("{basePath}/{plan}/actividades/{actividad}/sesion"). */
  vivoBaseUrl?: string;
  /** Mostrar evaluación en los contadores (solo si la capacitación tiene evaluación). */
  conEvaluacion?: boolean;
  independiente?: boolean;
}) {
  const [pendiente, iniciar] = useTransition();

  if (sessions.length === 0) {
    return (
      <p className="surface p-5 text-sm leading-relaxed text-muted-foreground">
        {independiente ? "Todavía no hay jornadas agendadas. Define la fecha y hora de tu capacitación con el botón Agendar jornada." : "Todavía no hay jornadas agendadas. El plan la programa por trimestre; aquí se agenda el día exacto."}
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
        const contadores = s.conteo
          ? [
              { Icono: UserCheck, valor: s.conteo.asistentes, etiqueta: s.conteo.asistentes === 1 ? "asistente" : "asistentes" },
              ...(conEvaluacion
                ? [
                    { Icono: FileQuestion, valor: s.conteo.presaber, etiqueta: "presaber" },
                    { Icono: ClipboardCheck, valor: s.conteo.postsaber, etiqueta: "postsaber" },
                  ]
                : []),
              { Icono: UserPlus, valor: s.conteo.invitados, etiqueta: s.conteo.invitados === 1 ? "invitado" : "invitados" },
            ]
          : [];
        return (
          <div key={s.id} className="surface group/fila space-y-4 p-5 transition-all duration-200 hover:shadow-md">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
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
                {s.vigente && (
                  <span
                    className="rounded-full border border-success/30 bg-success/10 px-2.5 py-0.5 text-[11px] font-bold text-success"
                    title="Los enlaces generales de la capacitación llevan hoy a esta jornada."
                  >
                    Vigente
                  </span>
                )}
              </div>
              <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-muted-foreground">
                <span className="font-semibold text-foreground/75">{TRAINING_MODALITY_LABELS[s.modality]}</span>
                {(s.location || s.municipio) && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                    {[s.location, s.municipio?.nombre].filter(Boolean).join(" · ")}
                  </span>
                )}
                {s.meetingUrl && !s.salaHref && (
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
            <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-border/40 pt-3 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
              {s.salaHref && !cerrada && (
                <a
                  href={s.salaHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-gradient-to-r from-primary to-success px-3.5 text-[12.5px] font-bold text-white shadow-sm transition-opacity hover:opacity-90"
                >
                  <Video className="h-3.5 w-3.5" aria-hidden="true" />
                  Abrir sala
                </a>
              )}
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
                titulo="¿Eliminar esta jornada?"
                descripcion={
                  s.conteo && s.conteo.asistentes + s.conteo.presaber + s.conteo.postsaber + s.conteo.invitados > 0
                    ? "Esta jornada ya tiene registros por sus enlaces (asistencia, evaluaciones o invitados), así que no se puede borrar: ciérrala en lugar de borrarla."
                    : "Se elimina esta jornada del calendario y sus enlaces y QR dejan de funcionar. La capacitación sigue en el plan. Solo se borra una jornada sin registros: si ya tiene asistencia, evaluaciones, invitados o conexiones a la sala, se cierra en lugar de borrarse."
                }
                size="icon-sm"
              />
            </div>
          </div>

            {contadores.length > 0 && (
              <ul className="flex flex-wrap gap-2" aria-label="Registrado en esta jornada">
                {contadores.map((c) => (
                  <li
                    key={c.etiqueta}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/70 px-2.5 py-1 text-[12px] text-muted-foreground"
                  >
                    <c.Icono className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                    <b className="tabular-nums text-foreground">{c.valor}</b> {c.etiqueta}
                  </li>
                ))}
              </ul>
            )}

            {s.accesos && s.accesos.length > 0 && <AccesosJornada accesos={s.accesos} fichaHref={s.fichaHref} />}
          </div>
        );
      })}
    </div>
  );
}
