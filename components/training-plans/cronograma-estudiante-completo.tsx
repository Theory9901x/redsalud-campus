"use client";

import { useState } from "react";
import { LayoutGrid, Table2, CalendarDays } from "lucide-react";
import {
  CronogramaEstudiante,
  type FilaCronograma,
  type AccionProxima,
  type SesionVirtual,
} from "@/components/training-plans/cronograma-estudiante";
import { TablaAmpliada } from "@/components/training-plans/cronograma-view";
import { SessionsCalendar, type SesionCalendario } from "@/components/training-plans/sessions-calendar";
import type { TrainingActivityTimelineItem } from "@/components/training-plans/training-activity-timeline";

const VISTAS = [
  { id: "mio", etiqueta: "Mi cronograma", Icono: LayoutGrid },
  { id: "ampliada", etiqueta: "Vista ampliada", Icono: Table2 },
  { id: "calendario", etiqueta: "Calendario", Icono: CalendarDays },
] as const;

type Vista = (typeof VISTAS)[number]["id"];

/**
 * El cronograma del estudiante en TODAS sus formas, no solo la personal:
 * su vista con estados y accesos propios, la tabla ampliada con el formato
 * del PIC y el calendario de jornadas. Las dos últimas son las mismas del
 * panel de gestión, en solo consulta: sin enlaces a fichas que el
 * estudiante no puede abrir (por eso areasGestionables=[] y linkable=false).
 */
export function CronogramaEstudianteCompleto({
  filas,
  acciones,
  sesionesVirtuales,
  activities,
  sessions,
  planId,
  onEntrar,
}: {
  filas: FilaCronograma[];
  acciones: AccionProxima[];
  sesionesVirtuales: SesionVirtual[];
  onEntrar: (activityId: string) => Promise<void>;
  activities: TrainingActivityTimelineItem[];
  sessions: SesionCalendario[];
  planId: string;
}) {
  const [vista, setVista] = useState<Vista>("mio");

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <div className="flex items-center gap-1 rounded-full border border-border/60 bg-card/80 p-1 shadow-sm backdrop-blur-sm">
          {VISTAS.map(({ id, etiqueta, Icono }) => (
            <button
              key={id}
              type="button"
              onClick={() => setVista(id)}
              className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                vista === id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icono className="h-3.5 w-3.5" aria-hidden="true" />
              {etiqueta}
            </button>
          ))}
        </div>
      </div>

      {vista === "mio" && (
        <CronogramaEstudiante filas={filas} acciones={acciones} sesionesVirtuales={sesionesVirtuales} onEntrar={onEntrar} />
      )}
      {vista === "ampliada" && (
        <TablaAmpliada activities={activities} basePath="" planId={planId} areasGestionables={[]} />
      )}
      {vista === "calendario" && (
        <SessionsCalendar sessions={sessions} basePath="" planId={planId} linkable={false} />
      )}
    </div>
  );
}
