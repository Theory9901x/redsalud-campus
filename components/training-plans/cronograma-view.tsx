"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { LayoutGrid, Table2, CalendarDays, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { COURSE_AUDIENCE_LABELS } from "@/components/cursos/labels";
import {
  TrainingActivityTimeline,
  type TrainingActivityTimelineItem,
} from "@/components/training-plans/training-activity-timeline";
import { SessionsCalendar, type SesionCalendario } from "@/components/training-plans/sessions-calendar";
import {
  TRAINING_ACTIVITY_STATUS_LABELS,
  TRAINING_ACTIVITY_STATUS_CLASSES,
} from "@/components/training-plans/labels";
import type { TrainingActivityStatus } from "@prisma/client";

type Actividad = TrainingActivityTimelineItem;

const TODAS = "TODAS";

/**
 * El cronograma en tres formas: tarjetas por área (para hojear), una tabla
 * ancha (para buscar y comparar) y un calendario mensual (para ver el día
 * exacto). Las dos primeras leen las líneas del PIC -programadas por
 * trimestre-; el calendario lee las jornadas reales (`TrainingSession`), que
 * son un dato distinto y todavía escaso: casi ninguna línea del plan tiene
 * fecha propia hasta que un área agenda una jornada concreta. Por eso el
 * calendario empieza casi vacío en vez de mostrar 55 días inventados.
 */
export function CronogramaView({
  activities,
  sessions,
  basePath,
  planId,
  adherenceByActivity,
  puedeEliminar = false,
  areasGestionables = null,
}: {
  activities: Actividad[];
  sessions: SesionCalendario[];
  basePath: string;
  planId: string;
  adherenceByActivity?: Record<string, number>;
  puedeEliminar?: boolean;
  /** Áreas que quien mira puede gestionar (null = todas). Ver TrainingActivityTimeline. */
  areasGestionables?: string[] | null;
}) {
  const [vista, setVista] = useState<"tarjetas" | "ampliada" | "calendario">("tarjetas");
  const [busqueda, setBusqueda] = useState("");
  const [area, setArea] = useState(TODAS);
  const [estado, setEstado] = useState<"TODAS" | TrainingActivityStatus>("TODAS");

  const areas = useMemo(() => {
    const nombres = new Set(activities.map((a) => a.area?.name ?? "Sin área"));
    return [...nombres].sort((x, y) => x.localeCompare(y, "es"));
  }, [activities]);

  const filtradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return activities
      .filter((a) => {
        if (area !== TODAS && (a.area?.name ?? "Sin área") !== area) return false;
        if (estado !== "TODAS" && a.status !== estado) return false;
        if (texto) {
          const enTexto = `${a.title} ${a.programa ?? ""} ${a.responsibleLabel ?? ""}`.toLowerCase();
          if (!enTexto.includes(texto)) return false;
        }
        return true;
      })
      .sort(
        // Por área primero, igual que las tarjetas: es el eje del plan, y sin
        // esto la tabla ancha mezcla áreas fila por fila y se vuelve
        // imposible de escanear.
        (a, b) =>
          (a.area?.sortOrder ?? 99) - (b.area?.sortOrder ?? 99) ||
          (a.programa ?? "").localeCompare(b.programa ?? "", "es") ||
          a.title.localeCompare(b.title, "es")
      );
  }, [activities, area, estado, busqueda]);

  return (
    <div className="space-y-4">
      <div className="surface flex flex-wrap items-center gap-3 p-3">
        {vista !== "calendario" && (
          <>
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por título, programa o responsable…"
                className="pl-8"
              />
            </div>

            <select
              value={area}
              onChange={(e) => setArea(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              aria-label="Filtrar por área"
            >
              <option value={TODAS}>Todas las áreas</option>
              {areas.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>

            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value as typeof estado)}
              className="h-9 rounded-md border border-input bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              aria-label="Filtrar por estado"
            >
              <option value="TODAS">Todos los estados</option>
              {Object.entries(TRAINING_ACTIVITY_STATUS_LABELS).map(([valor, etiqueta]) => (
                <option key={valor} value={valor}>
                  {etiqueta}
                </option>
              ))}
            </select>
          </>
        )}

        <div className="ml-auto flex items-center gap-1 rounded-md bg-muted p-0.5">
          <button
            type="button"
            onClick={() => setVista("tarjetas")}
            className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors ${
              vista === "tarjetas" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
            Tarjetas
          </button>
          <button
            type="button"
            onClick={() => setVista("ampliada")}
            className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors ${
              vista === "ampliada" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Table2 className="h-3.5 w-3.5" aria-hidden="true" />
            Vista ampliada
          </button>
          <button
            type="button"
            onClick={() => setVista("calendario")}
            className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors ${
              vista === "calendario" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            Calendario
          </button>
        </div>
      </div>

      {vista !== "calendario" && (
        <p className="text-xs text-muted-foreground">
          {filtradas.length} de {activities.length} capacitaciones
          {(area !== TODAS || estado !== "TODAS" || busqueda) && " · filtro activo"}
        </p>
      )}

      {vista === "tarjetas" && (
        <TrainingActivityTimeline
          activities={filtradas}
          basePath={basePath}
          planId={planId}
          adherenceByActivity={adherenceByActivity}
          puedeEliminar={puedeEliminar}
          areasGestionables={areasGestionables}
        />
      )}
      {vista === "ampliada" && (
        <TablaAmpliada activities={filtradas} basePath={basePath} planId={planId} areasGestionables={areasGestionables} />
      )}
      {vista === "calendario" && <SessionsCalendar sessions={sessions} basePath={basePath} planId={planId} />}
    </div>
  );
}

function TablaAmpliada({
  activities,
  basePath,
  planId,
  areasGestionables,
}: {
  activities: Actividad[];
  basePath: string;
  planId: string;
  areasGestionables: string[] | null;
}) {
  if (activities.length === 0) {
    return <p className="surface p-6 text-center text-sm text-muted-foreground">Nada coincide con el filtro.</p>;
  }

  /*
   * El formato es EL DEL PIC: Área · Actividad · Objetivo · Metodología ·
   * Dirigido a · N° de personas · Responsable · trimestres con X ·
   * Seguimiento. Es el documento que la institución firma y conoce; la
   * vista ampliada lo replica para que quien lo trabaja en Excel encuentre
   * aquí las mismas columnas, con el estado vivo encima.
   */
  return (
    <div className="surface p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Área</TableHead>
            <TableHead>Actividad</TableHead>
            <TableHead>Objetivo</TableHead>
            <TableHead>Metodología</TableHead>
            <TableHead>Dirigido a</TableHead>
            <TableHead>N° personas</TableHead>
            <TableHead>Responsable</TableHead>
            <TableHead className="text-center">T1</TableHead>
            <TableHead className="text-center">T2</TableHead>
            <TableHead className="text-center">T3</TableHead>
            <TableHead className="text-center">T4</TableHead>
            <TableHead>Seguimiento</TableHead>
            <TableHead>Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {activities.map((a) => {
            const gestionable = areasGestionables === null || (a.area !== null && areasGestionables.includes(a.area.id));
            return (
              <TableRow key={a.id} className="align-top">
                <TableCell className="whitespace-normal align-top">
                  <span className="font-medium text-foreground">{a.area?.name ?? "Sin área"}</span>
                  {a.programa && <span className="block text-[11px] text-muted-foreground">{a.programa}</span>}
                </TableCell>
                <TableCell className="w-[200px] max-w-[200px] whitespace-normal align-top">
                  {gestionable ? (
                    <Link
                      href={`${basePath}/${planId}/actividades/${a.id}`}
                      className="text-[12px] font-semibold leading-snug text-foreground hover:text-primary hover:underline"
                    >
                      {a.title}
                    </Link>
                  ) : (
                    <span className="text-[12px] font-semibold leading-snug text-foreground">{a.title}</span>
                  )}
                </TableCell>
                <TableCell className="w-[220px] max-w-[220px] whitespace-normal align-top text-[11px] leading-snug text-muted-foreground">
                  {a.objective ?? "—"}
                </TableCell>
                <TableCell className="w-[220px] max-w-[220px] whitespace-normal align-top text-[11px] leading-snug text-muted-foreground">
                  {a.methodology ?? "—"}
                </TableCell>
                <TableCell className="w-[150px] max-w-[150px] whitespace-normal align-top text-[11px] leading-snug text-muted-foreground">
                  {a.targetAudienceNote ?? COURSE_AUDIENCE_LABELS[a.targetAudience]}
                </TableCell>
                <TableCell className="whitespace-normal align-top text-[11px] text-muted-foreground">
                  {a.expectedAttendees ?? a.expectedAttendeesNote ?? "—"}
                </TableCell>
                <TableCell className="w-[140px] max-w-[140px] whitespace-normal align-top text-[11px] leading-snug text-muted-foreground">
                  {a.responsibleLabel ?? "—"}
                </TableCell>
                {[1, 2, 3, 4].map((t) => (
                  <TableCell key={t} className="text-center align-top">
                    {a.quarters.includes(t) ? (
                      <span className="font-bold text-primary">X</span>
                    ) : (
                      <span className="text-muted-foreground/40">·</span>
                    )}
                  </TableCell>
                ))}
                <TableCell className="w-[170px] max-w-[170px] whitespace-normal align-top text-[11px] leading-snug text-muted-foreground">
                  {a.followUpEvidence.length > 0
                    ? a.followUpEvidence.map((e, i) => `${i + 1}. ${e}`).join(" ")
                    : "—"}
                </TableCell>
                <TableCell className="align-top">
                  <Badge className={TRAINING_ACTIVITY_STATUS_CLASSES[a.status]}>
                    {TRAINING_ACTIVITY_STATUS_LABELS[a.status]}
                  </Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
