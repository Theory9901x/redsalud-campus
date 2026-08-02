"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { LayoutGrid, Table2, Search, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { COURSE_AUDIENCE_LABELS } from "@/components/cursos/labels";
import {
  TrainingActivityTimeline,
  type TrainingActivityTimelineItem,
} from "@/components/training-plans/training-activity-timeline";
import {
  TRAINING_ACTIVITY_STATUS_LABELS,
  TRAINING_ACTIVITY_STATUS_CLASSES,
  etiquetaProgramacion,
} from "@/components/training-plans/labels";
import type { TrainingActivityStatus } from "@prisma/client";

type Actividad = TrainingActivityTimelineItem;

const TODAS = "TODAS";

/**
 * El cronograma en dos formas: tarjetas por área (para hojear) y una tabla
 * ancha con todo a la vista (para buscar, comparar y exportar mentalmente
 * de un vistazo). La misma información, dos formas de leerla.
 *
 * No hay vista de calendario por día: casi todas las capacitaciones del
 * plan solo tienen trimestre, no fecha -así las programa el PIC-, así que
 * una grilla de días quedaría vacía para el 90% de las filas y sería un
 * calendario que miente por omisión. El día llega cuando se agenda una
 * jornada concreta, que es un dato distinto y todavía no existe para casi
 * ninguna.
 */
export function CronogramaView({
  activities,
  basePath,
  planId,
  adherenceByActivity,
  puedeEliminar = false,
}: {
  activities: Actividad[];
  basePath: string;
  planId: string;
  adherenceByActivity?: Record<string, number>;
  puedeEliminar?: boolean;
}) {
  const [vista, setVista] = useState<"tarjetas" | "ampliada">("tarjetas");
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
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {filtradas.length} de {activities.length} capacitaciones
        {(area !== TODAS || estado !== "TODAS" || busqueda) && " · filtro activo"}
      </p>

      {vista === "tarjetas" ? (
        <TrainingActivityTimeline
          activities={filtradas}
          basePath={basePath}
          planId={planId}
          adherenceByActivity={adherenceByActivity}
          puedeEliminar={puedeEliminar}
        />
      ) : (
        <TablaAmpliada activities={filtradas} basePath={basePath} planId={planId} adherenceByActivity={adherenceByActivity} />
      )}
    </div>
  );
}

function TablaAmpliada({
  activities,
  basePath,
  planId,
  adherenceByActivity,
}: {
  activities: Actividad[];
  basePath: string;
  planId: string;
  adherenceByActivity?: Record<string, number>;
}) {
  if (activities.length === 0) {
    return <p className="surface p-6 text-center text-sm text-muted-foreground">Nada coincide con el filtro.</p>;
  }

  return (
    <div className="surface p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Área</TableHead>
            <TableHead>Capacitación</TableHead>
            <TableHead>Dirigido a</TableHead>
            <TableHead>Responsable</TableHead>
            <TableHead>Programación</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Adherencia</TableHead>
            <TableHead>Curso</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {activities.map((a) => (
            <TableRow key={a.id}>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium text-foreground">{a.area?.name ?? "Sin área"}</span>
                  {a.programa && <span className="text-xs text-muted-foreground">{a.programa}</span>}
                </div>
              </TableCell>
              <TableCell className="w-[280px] max-w-[280px] whitespace-normal">
                <Link
                  href={`${basePath}/${planId}/actividades/${a.id}`}
                  className="font-medium leading-snug text-foreground hover:text-primary hover:underline"
                >
                  {a.title}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">{COURSE_AUDIENCE_LABELS[a.targetAudience]}</TableCell>
              <TableCell className="text-muted-foreground">{a.responsibleLabel ?? "—"}</TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">{etiquetaProgramacion(a)}</TableCell>
              <TableCell>
                <Badge className={TRAINING_ACTIVITY_STATUS_CLASSES[a.status]}>{TRAINING_ACTIVITY_STATUS_LABELS[a.status]}</Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {adherenceByActivity?.[a.id] !== undefined ? `${adherenceByActivity[a.id]}%` : "—"}
              </TableCell>
              <TableCell>
                {a.course ? (
                  <Link
                    href={`/cursos/${a.course.slug}`}
                    target="_blank"
                    className="flex items-center gap-1 text-primary hover:underline"
                  >
                    Ver <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </Link>
                ) : (
                  <span className="text-warning">Sin contenido</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
