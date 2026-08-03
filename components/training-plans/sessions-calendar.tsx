"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { EmptyState } from "@/components/brand/empty-state";
import { TRAINING_ACTIVITY_STATUS_LABELS, SESSION_SHIFT_LABELS } from "@/components/training-plans/labels";
import type { TrainingActivityStatus, TrainingModality, SessionShift } from "@prisma/client";

export type SesionCalendario = {
  id: string;
  startsAt: Date;
  endsAt: Date | null;
  /** Hora ya formateada en el servidor (ver nota en TrainingSessionList: Intl en cliente hidrata distinto). */
  horaEtiqueta: string;
  status: TrainingActivityStatus;
  modality: TrainingModality;
  shift: SessionShift | null;
  activity: { id: string; title: string; area: { id: string; name: string } | null };
};

const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
// Sin Intl en este archivo: es un componente de cliente y las cadenas deben
// ser idénticas a las del servidor. Los meses van en tabla fija.
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

/**
 * Punto de estado, no color categórico: mismo criterio que el resto del
 * módulo (badges de estado ya reservan estos tonos). Verde = ya se abrió,
 * ámbar = agendada pero sin habilitar, gris = cerrada.
 */
const PUNTO_ESTADO: Record<TrainingActivityStatus, string> = {
  DRAFT: "bg-warning",
  OPEN: "bg-success",
  CLOSED: "bg-muted-foreground",
};

function claveDia(fecha: Date) {
  return `${fecha.getFullYear()}-${fecha.getMonth()}-${fecha.getDate()}`;
}

/**
 * Calendario mensual de jornadas REALES, no del trimestre del plan.
 *
 * Es la vista que solo tiene sentido una vez existen fechas concretas: casi
 * ninguna línea del PIC las tiene todavía -solo trimestre-, así que este
 * calendario empieza casi vacío y se va llenando a medida que cada área
 * agenda sus jornadas desde la ficha de su capacitación. No se inventa
 * ningún día para rellenarlo.
 */
export function SessionsCalendar({ sessions, basePath, planId }: { sessions: SesionCalendario[]; basePath: string; planId: string }) {
  const hoy = useMemo(() => new Date(), []);
  const primerMesConSesion = sessions.find((s) => s.startsAt >= hoy)?.startsAt ?? sessions[0]?.startsAt ?? hoy;
  const [cursor, setCursor] = useState(() => new Date(primerMesConSesion.getFullYear(), primerMesConSesion.getMonth(), 1));

  const porDia = useMemo(() => {
    const mapa = new Map<string, SesionCalendario[]>();
    for (const s of sessions) {
      const clave = claveDia(s.startsAt);
      const lista = mapa.get(clave) ?? [];
      lista.push(s);
      mapa.set(clave, lista);
    }
    return mapa;
  }, [sessions]);

  const celdas = useMemo(() => {
    const primerDiaMes = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    // Lunes = 0 ... domingo = 6, para que la semana empiece igual que DIAS_SEMANA.
    const offset = (primerDiaMes.getDay() + 6) % 7;
    const inicio = new Date(primerDiaMes);
    inicio.setDate(inicio.getDate() - offset);

    return Array.from({ length: 42 }, (_, i) => {
      const fecha = new Date(inicio);
      fecha.setDate(fecha.getDate() + i);
      return {
        fecha,
        delMes: fecha.getMonth() === cursor.getMonth(),
        esHoy: claveDia(fecha) === claveDia(hoy),
        sesiones: porDia.get(claveDia(fecha)) ?? [],
      };
    });
  }, [cursor, porDia, hoy]);

  const etiquetaMes = `${MESES[cursor.getMonth()]} de ${cursor.getFullYear()}`;

  return (
    <div className="space-y-3">
      <div className="surface flex items-center justify-between p-3">
        <button
          type="button"
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Mes anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
          {etiquetaMes}
        </p>
        <button
          type="button"
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Mes siguiente"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {sessions.length === 0 && (
        <EmptyState
          icon={CalendarDays}
          title="Todavía no hay jornadas agendadas"
          description="El plan programa por trimestre; aquí aparece el día exacto en cuanto un área agenda una jornada desde su capacitación."
        />
      )}

      <div className="surface overflow-hidden p-0">
        <div className="grid grid-cols-7 border-b border-border bg-muted/40">
          {DIAS_SEMANA.map((d) => (
            <div key={d} className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {celdas.map(({ fecha, delMes, esHoy, sesiones }) => (
            <div
              key={fecha.toISOString()}
              className={`min-h-[104px] border-b border-r border-border p-1.5 [&:nth-child(7n)]:border-r-0 ${
                delMes ? "" : "bg-muted/20"
              }`}
            >
              <span
                className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                  esHoy
                    ? "bg-primary text-primary-foreground"
                    : delMes
                      ? "text-foreground"
                      : "text-muted-foreground/60"
                }`}
              >
                {fecha.getDate()}
              </span>
              <div className="mt-1 space-y-1">
                {sesiones.slice(0, 3).map((s) => (
                  <Link
                    key={s.id}
                    href={`${basePath}/${planId}/actividades/${s.activity.id}`}
                    title={`${s.activity.title} · ${TRAINING_ACTIVITY_STATUS_LABELS[s.status]}${s.shift ? ` · ${SESSION_SHIFT_LABELS[s.shift]}` : ""}`}
                    className="flex items-center gap-1 rounded px-1 py-0.5 text-[11px] leading-tight text-foreground hover:bg-accent"
                  >
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${PUNTO_ESTADO[s.status]}`} aria-hidden="true" />
                    <span className="truncate">
                      {s.horaEtiqueta} {s.activity.area?.name ?? s.activity.title}
                    </span>
                  </Link>
                ))}
                {sesiones.length > 3 && (
                  <p className="px-1 text-[10px] text-muted-foreground">+{sesiones.length - 3} más</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-warning" /> Borrador
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-success" /> Abierta
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" /> Cerrada
        </span>
      </div>
    </div>
  );
}
