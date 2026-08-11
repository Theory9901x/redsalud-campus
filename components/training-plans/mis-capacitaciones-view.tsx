"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  GraduationCap,
  BookOpen,
  Users,
  UserRound,
  Clock3,
  CircleCheck,
  ChevronRight,
  Search,
  SlidersHorizontal,
  Sparkles,
  ClipboardCheck,
} from "lucide-react";
import { EmptyState } from "@/components/brand/empty-state";
import { cn } from "@/lib/utils";

/** Lo que la vista necesita de cada plan, ya resuelto en el servidor. */
export type PlanTarjeta = {
  id: string;
  title: string;
  year: number;
  estadoLabel: string;
  estadoTono: "activo" | "cerrado" | "borrador";
  targetDepartment: string | null;
  tutorName: string;
  totalActividades: number;
  completadas: number;
  evaluacionesDisponibles: number;
  progreso: number | null;
  /** Ya formateada en el servidor: nunca Intl en cliente (hidrata distinto). */
  proximaJornada: { titulo: string; etiqueta: string } | null;
};

export type ResumenCapacitaciones = {
  actividades: number;
  completadas: number;
  evaluacionesDisponibles: number;
  proximasJornadas: number;
  progreso: number | null;
};

const TONO_ESTADO: Record<PlanTarjeta["estadoTono"], string> = {
  activo: "border-success/30 bg-success/10 text-success",
  cerrado: "border-border bg-muted text-muted-foreground",
  borrador: "border-warning/30 bg-warning/15 text-warning-foreground",
};

/** Barra de avance con su valor accesible para lectores de pantalla. */
function BarraProgreso({ valor }: { valor: number }) {
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-foreground/10"
      role="progressbar"
      aria-valuenow={valor}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Progreso general del plan"
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-primary to-success transition-[width] duration-500"
        style={{ width: `${valor}%` }}
      />
    </div>
  );
}

function TarjetaPlan({ plan }: { plan: PlanTarjeta }) {
  const FICHA = [
    { icon: Users, valor: plan.targetDepartment ?? "Todo el personal" },
    { icon: UserRound, valor: plan.tutorName },
    {
      icon: BookOpen,
      valor: `${plan.totalActividades} ${plan.totalActividades === 1 ? "actividad" : "actividades"}`,
    },
  ];

  return (
    <article className="surface-lumen lumen-edge lumen-hover group overflow-hidden">
      <div className="p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-success/15 text-primary">
            <GraduationCap className="h-7 w-7" strokeWidth={1.7} aria-hidden="true" />
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide",
              TONO_ESTADO[plan.estadoTono]
            )}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
            {plan.estadoLabel}
          </span>
        </div>

        <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Plan institucional</p>
        <h3 className="mt-1 font-display text-[19px] font-bold leading-snug tracking-tight text-foreground sm:text-[21px]">
          {plan.title}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">Ruta institucional de formación · Vigencia {plan.year}</p>

        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2">
          {FICHA.map((f) => (
            <span key={f.valor} className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
              <f.icon className="h-4 w-4 shrink-0 text-primary/70" strokeWidth={1.7} aria-hidden="true" />
              <span className="truncate">{f.valor}</span>
            </span>
          ))}
        </div>

        <div className="mt-5 border-t border-border/60 pt-5">
          {plan.progreso !== null ? (
            <>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Progreso general
                </span>
                <span className="font-display text-lg font-extrabold text-foreground">{plan.progreso}%</span>
              </div>
              <div className="mt-2">
                <BarraProgreso valor={plan.progreso} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {plan.completadas} de {plan.totalActividades} capacitaciones completadas
              </p>
            </>
          ) : (
            // Sin inscripciones todavía: se dice lo que hay, no un 0 % inventado.
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{plan.totalActividades}</span>{" "}
              {plan.totalActividades === 1 ? "capacitación programada" : "capacitaciones programadas"} para ti en este
              plan.
            </p>
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-end justify-between gap-4 border-t border-border/60 pt-5">
          <div className="min-w-0">
            {plan.proximaJornada ? (
              <>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Próxima jornada</p>
                <p className="mt-1 truncate text-sm font-semibold text-foreground">{plan.proximaJornada.titulo}</p>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock3 className="h-3.5 w-3.5" strokeWidth={1.7} aria-hidden="true" />
                  {plan.proximaJornada.etiqueta}
                </p>
              </>
            ) : plan.evaluacionesDisponibles > 0 ? (
              <p className="flex items-center gap-1.5 text-sm font-semibold text-warning-foreground">
                <ClipboardCheck className="h-4 w-4" strokeWidth={1.7} aria-hidden="true" />
                {plan.evaluacionesDisponibles}{" "}
                {plan.evaluacionesDisponibles === 1 ? "evaluación disponible" : "evaluaciones disponibles"}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Sin jornadas agendadas por ahora.</p>
            )}
          </div>

          <Link
            href={`/mis-capacitaciones/${plan.id}`}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-transform duration-150 hover:-translate-y-0.5 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Ver capacitación
            <ChevronRight
              className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
              strokeWidth={2}
              aria-hidden="true"
            />
          </Link>
        </div>
      </div>
    </article>
  );
}

/**
 * "Mis capacitaciones": el centro personal de formación del estudiante.
 *
 * Responde en un vistazo dónde está, qué plan tiene, cuánto contenido le
 * corresponde, qué sigue y por dónde entra. Los filtros solo aparecen cuando
 * hay más de un plan: con uno solo son ruido.
 */
export function MisCapacitacionesView({
  planes,
  resumen,
  anios,
}: {
  planes: PlanTarjeta[];
  resumen: ResumenCapacitaciones;
  anios: number[];
}) {
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState("TODOS");
  const [anio, setAnio] = useState("TODOS");

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return planes.filter((p) => {
      if (estado !== "TODOS" && p.estadoTono !== estado) return false;
      if (anio !== "TODOS" && String(p.year) !== anio) return false;
      if (texto && !`${p.title} ${p.tutorName}`.toLowerCase().includes(texto)) return false;
      return true;
    });
  }, [planes, busqueda, estado, anio]);

  const KPIS = [
    {
      valor: String(resumen.actividades),
      etiqueta: "Actividades programadas",
      icon: CalendarDays,
      chip: "bg-primary/12 text-primary",
    },
    {
      valor: String(resumen.completadas),
      etiqueta: "Completadas",
      icon: CircleCheck,
      chip: "bg-success/15 text-success",
    },
    {
      valor: String(resumen.evaluacionesDisponibles),
      etiqueta: "Evaluaciones disponibles",
      icon: ClipboardCheck,
      chip: "bg-warning/18 text-warning-foreground",
      destacar: resumen.evaluacionesDisponibles > 0,
    },
    ...(resumen.progreso !== null
      ? [
          {
            valor: `${resumen.progreso}%`,
            etiqueta: "Progreso general",
            icon: Sparkles,
            chip: "bg-primary/12 text-primary",
          },
        ]
      : [
          {
            valor: String(resumen.proximasJornadas),
            etiqueta: "Próximas jornadas",
            icon: Clock3,
            chip: "bg-primary/12 text-primary",
          },
        ]),
  ];

  const hayFiltros = planes.length > 1;
  const filtroActivo = busqueda.trim() !== "" || estado !== "TODOS" || anio !== "TODOS";

  return (
    <div className="space-y-8">
      {/* Resumen */}
      <section aria-label="Resumen de tu formación">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {KPIS.map((k) => (
            <div key={k.etiqueta} className="surface-lumen flex items-center gap-4 p-5">
              <span className={cn("relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", k.chip)}>
                <k.icon className="h-5 w-5" strokeWidth={1.7} aria-hidden="true" />
                {"destacar" in k && k.destacar && (
                  <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-warning" aria-hidden="true" />
                )}
              </span>
              <div className="min-w-0">
                <p className="font-display text-2xl font-extrabold leading-none tracking-tight text-foreground">
                  {k.valor}
                </p>
                <p className="mt-1 text-[13px] leading-tight text-muted-foreground">{k.etiqueta}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Planes */}
      <section aria-label="Planes asignados" className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="font-display text-xl font-bold tracking-tight text-foreground sm:text-[21px]">
            Planes asignados
          </h2>

          {hayFiltros && (
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  strokeWidth={1.7}
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar plan…"
                  aria-label="Buscar plan"
                  className="h-10 w-52 rounded-full border border-border/60 bg-card/80 pl-9 pr-3 text-sm text-foreground outline-none backdrop-blur-sm placeholder:text-muted-foreground focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/25"
                />
              </div>
              <select
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
                aria-label="Filtrar por estado"
                className="h-10 rounded-full border border-border/60 bg-card/80 px-4 text-sm text-foreground outline-none backdrop-blur-sm focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/25"
              >
                <option value="TODOS">Todos los estados</option>
                <option value="activo">Activo</option>
                <option value="cerrado">Cerrado</option>
                <option value="borrador">Borrador</option>
              </select>
              {anios.length > 1 && (
                <select
                  value={anio}
                  onChange={(e) => setAnio(e.target.value)}
                  aria-label="Filtrar por año"
                  className="h-10 rounded-full border border-border/60 bg-card/80 px-4 text-sm text-foreground outline-none backdrop-blur-sm focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/25"
                >
                  <option value="TODOS">Todos los años</option>
                  {anios.map((a) => (
                    <option key={a} value={String(a)}>
                      {a}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>

        {filtrados.length === 0 ? (
          <div className="surface-lumen p-8">
            <EmptyState
              icon={filtroActivo ? SlidersHorizontal : CalendarDays}
              title={filtroActivo ? "Ningún plan coincide con el filtro" : "Sin planes asignados"}
              description={
                filtroActivo
                  ? "Prueba con otro texto o quita los filtros para ver todos tus planes."
                  : "Cuando Talento Humano te asigne un plan de capacitación, aparecerá aquí con su cronograma, documentos y evaluaciones."
              }
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            {filtrados.map((plan) => (
              <TarjetaPlan key={plan.id} plan={plan} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
