"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarClock,
  Check,
  ChevronDown,
  ClipboardList,
  Layers,
  MapPin,
  MonitorPlay,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TRAINING_MODALITY_LABELS } from "@/components/training-plans/labels";
import type { AccionTablero, FilaTablero, PasoCiclo } from "@/lib/tablero-evaluaciones";
import type { TrainingModality } from "@prisma/client";

type Agrupacion = "area" | "pendiente" | "trimestre" | "cronologico" | "modalidad";
type FiltroTipo = "todas" | "presaber" | "postsaber" | "encuesta";
type FiltroEstado = "todos" | "pendiente" | "en-curso" | "completada";

const ROMANO = ["I", "II", "III", "IV"];

/**
 * Categoría de la lista "Por pendiente": lo primero que la persona tiene
 * DISPONIBLE ahora mismo; si no hay nada, si el ciclo está completo o al día.
 */
function categoriaPendiente(f: FilaTablero): { clave: string; titulo: string; orden: number } {
  const disponible = f.pasos.find((p) => p.estado === "disponible");
  if (disponible?.clave === "presaber") return { clave: "presaber", titulo: "Presaber por presentar", orden: 1 };
  if (disponible?.clave === "postsaber") return { clave: "postsaber", titulo: "Postsaber por presentar", orden: 2 };
  if (disponible?.clave === "encuesta") return { clave: "encuesta", titulo: "Encuesta por responder", orden: 3 };
  if (disponible?.clave === "capacitacion")
    return { clave: "en-curso", titulo: "Capacitación en curso", orden: 4 };
  if (f.cicloCompleto) return { clave: "completas", titulo: "Ciclo completo · consulta", orden: 5 };
  return { clave: "al-dia", titulo: "Al día por ahora", orden: 6 };
}

/**
 * FASE 10 — Tablero de /evaluaciones: la unidad es la CAPACITACIÓN con su
 * ciclo completo como stepper, no el examen suelto. Cuatro agrupaciones
 * (área por defecto, trimestre, cronológico, modalidad), filtros
 * combinables y buscador; todo en cliente sobre las ~55 filas ya agregadas
 * en el servidor.
 */
export function TableroEvaluaciones({ filas }: { filas: FilaTablero[] }) {
  const [agrupacion, setAgrupacion] = useState<Agrupacion>("area");
  const [tipo, setTipo] = useState<FiltroTipo>("todas");
  const [estado, setEstado] = useState<FiltroEstado>("todos");
  const [modalidad, setModalidad] = useState<TrainingModality | "todas">("todas");
  const [trimestre, setTrimestre] = useState<number | 0>(0);
  const [busqueda, setBusqueda] = useState("");
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set());

  const filtradas = useMemo(() => {
    return filas.filter((f) => {
      if (busqueda && !f.titulo.toLowerCase().includes(busqueda.toLowerCase())) return false;
      if (modalidad !== "todas" && f.modalidad !== modalidad) return false;
      if (trimestre !== 0 && !f.trimestres.includes(trimestre)) return false;
      if (tipo !== "todas") {
        const paso = f.pasos.find((p) => p.clave === tipo);
        if (!paso || paso.estado === "no-aplica") return false;
      }
      if (estado === "pendiente" && f.pendientes === 0) return false;
      if (estado === "completada" && !f.cicloCompleto) return false;
      if (estado === "en-curso" && (f.cicloCompleto || f.pendientes === 0)) return false;
      return true;
    });
  }, [filas, busqueda, modalidad, trimestre, tipo, estado]);

  // ---- agrupación ---------------------------------------------------------
  const grupos = useMemo(() => {
    if (agrupacion === "cronologico") {
      const orden = [...filtradas].sort((a, b) => {
        if (a.fechaOrden && b.fechaOrden) return a.fechaOrden.localeCompare(b.fechaOrden);
        if (a.fechaOrden) return -1;
        if (b.fechaOrden) return 1;
        return a.titulo.localeCompare(b.titulo, "es");
      });
      return [{ clave: "crono", titulo: "Por fecha más próxima", filas: orden }];
    }
    const mapa = new Map<string, { titulo: string; orden: number; filas: FilaTablero[] }>();
    for (const f of filtradas) {
      const claves =
        agrupacion === "area"
          ? [{ clave: f.area, titulo: f.area, orden: f.areaOrden }]
          : agrupacion === "pendiente"
            ? [categoriaPendiente(f)]
            : agrupacion === "modalidad"
            ? [{ clave: f.modalidad, titulo: TRAINING_MODALITY_LABELS[f.modalidad], orden: 0 }]
            : (f.trimestres.length > 0 ? f.trimestres : [0]).map((t) => ({
                clave: `T${t}`,
                titulo: t === 0 ? "Sin trimestre" : `Trimestre ${ROMANO[t - 1]}`,
                orden: t,
              }));
      for (const c of claves) {
        const g = mapa.get(c.clave) ?? { titulo: c.titulo, orden: c.orden, filas: [] };
        g.filas.push(f);
        mapa.set(c.clave, g);
      }
    }
    return [...mapa.entries()]
      .sort((a, b) => a[1].orden - b[1].orden || a[1].titulo.localeCompare(b[1].titulo, "es"))
      .map(([clave, g]) => ({ clave, titulo: g.titulo, filas: g.filas }));
  }, [filtradas, agrupacion]);

  function alternar(clave: string) {
    setAbiertas((prev) => {
      const s = new Set(prev);
      if (s.has(clave)) s.delete(clave);
      else s.add(clave);
      return s;
    });
  }

  const controlSegmento = (activo: boolean) =>
    cn(
      "rounded-full px-3.5 py-2 text-[12.5px] font-semibold transition-colors",
      activo ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
    );

  return (
    <div className="space-y-5">
      {/* Selector de agrupación + filtros, en una banda */}
      <div className="surface-lumen space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 rounded-full border border-border/60 bg-card/80 p-1 backdrop-blur-sm">
            {(
              [
                { valor: "area", etiqueta: "Por área" },
                { valor: "pendiente", etiqueta: "Por pendiente" },
                { valor: "trimestre", etiqueta: "Por trimestre" },
                { valor: "cronologico", etiqueta: "Cronológico" },
                { valor: "modalidad", etiqueta: "Por modalidad" },
              ] as const
            ).map((o) => (
              <button key={o.valor} type="button" onClick={() => setAgrupacion(o.valor)} className={controlSegmento(agrupacion === o.valor)}>
                {o.etiqueta}
              </button>
            ))}
          </div>

          <div className="relative min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar capacitación…"
              aria-label="Buscar capacitación"
              className="h-9 w-full rounded-full border border-border/60 bg-card/70 pl-9 pr-4 text-[13px] outline-none backdrop-blur-sm transition-colors focus:border-primary/50"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Tabs de tipo (el patrón visual anterior, ahora como filtro) */}
          <div className="flex items-center gap-1 rounded-full border border-border/60 bg-card/80 p-1 backdrop-blur-sm">
            {(
              [
                { valor: "todas", etiqueta: "Todas" },
                { valor: "presaber", etiqueta: "Presaber" },
                { valor: "postsaber", etiqueta: "Postsaber" },
                { valor: "encuesta", etiqueta: "Encuestas" },
              ] as const
            ).map((o) => (
              <button key={o.valor} type="button" onClick={() => setTipo(o.valor)} className={controlSegmento(tipo === o.valor)}>
                {o.etiqueta}
              </button>
            ))}
          </div>

          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value as FiltroEstado)}
            aria-label="Filtrar por estado"
            className="h-9 rounded-full border border-border/60 bg-card/70 px-3.5 text-[12.5px] font-semibold text-foreground outline-none backdrop-blur-sm"
          >
            <option value="todos">Todos los estados</option>
            <option value="pendiente">Con pendientes</option>
            <option value="en-curso">En curso</option>
            <option value="completada">Ciclo completo</option>
          </select>

          <select
            value={modalidad}
            onChange={(e) => setModalidad(e.target.value as TrainingModality | "todas")}
            aria-label="Filtrar por modalidad"
            className="h-9 rounded-full border border-border/60 bg-card/70 px-3.5 text-[12.5px] font-semibold text-foreground outline-none backdrop-blur-sm"
          >
            <option value="todas">Toda modalidad</option>
            <option value="VIRTUAL">Virtual</option>
            <option value="PRESENCIAL">Presencial</option>
            <option value="MIXTA">Mixta</option>
          </select>

          <select
            value={trimestre}
            onChange={(e) => setTrimestre(Number(e.target.value))}
            aria-label="Filtrar por trimestre"
            className="h-9 rounded-full border border-border/60 bg-card/70 px-3.5 text-[12.5px] font-semibold text-foreground outline-none backdrop-blur-sm"
          >
            <option value={0}>Todo el año</option>
            {[1, 2, 3, 4].map((t) => (
              <option key={t} value={t}>
                Trimestre {ROMANO[t - 1]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Secciones */}
      {grupos.length === 0 ? (
        <p className="surface-lumen p-10 text-center text-[14px] text-muted-foreground">
          Nada coincide con los filtros.
        </p>
      ) : (
        grupos.map((g) => {
          const pendientes = g.filas.reduce((s, f) => s + f.pendientes, 0);
          const colapsable = agrupacion !== "cronologico";
          const abierta = !colapsable || abiertas.size === 0 ? true : abiertas.has(g.clave);
          // Con todo colapsado por defecto no se ve nada: la primera con
          // pendientes arranca abierta y el resto se abre al tocar.
          const mostrar = colapsable ? (abiertas.size === 0 ? pendientes > 0 || g === grupos[0] : abiertas.has(g.clave)) : true;
          void abierta;

          return (
            <section key={g.clave} className="surface-lumen overflow-hidden">
              {colapsable ? (
                <button
                  type="button"
                  onClick={() => alternar(g.clave)}
                  className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
                  aria-expanded={mostrar}
                >
                  <span className="flex items-center gap-2.5">
                    <Layers className="h-4 w-4 text-primary" aria-hidden="true" />
                    <span className="font-display text-[15px] font-bold text-foreground">{g.titulo}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                      {g.filas.length}
                    </span>
                    {pendientes > 0 && (
                      <span className="rounded-full bg-warning/18 px-2 py-0.5 text-[11px] font-bold text-warning-foreground">
                        {pendientes} {pendientes === 1 ? "pendiente" : "pendientes"}
                      </span>
                    )}
                  </span>
                  <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", mostrar && "rotate-180")} />
                </button>
              ) : (
                <p className="px-5 py-4 font-display text-[15px] font-bold text-foreground">{g.titulo}</p>
              )}

              {mostrar &&
                (pendientes === 0 && g.filas.every((f) => f.cicloCompleto) ? (
                  <p className="border-t border-border/40 px-5 py-5 text-[13.5px] text-success">
                    No tienes pendientes de {g.titulo} 🎉
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-3 border-t border-border/40 p-4 lg:grid-cols-2">
                    {g.filas.map((f) => (
                      <TarjetaCiclo key={`${g.clave}-${f.id}`} fila={f} />
                    ))}
                  </div>
                ))}
            </section>
          );
        })
      )}
    </div>
  );
}

// ------------------------------------------------------------- tarjeta

function TarjetaCiclo({ fila }: { fila: FilaTablero }) {
  const esPresencial = fila.modalidad === "PRESENCIAL";
  return (
    <article className="surface flex flex-col gap-3 rounded-2xl border border-border/50 bg-card/70 p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="line-clamp-2 font-display text-[14.5px] font-bold leading-snug text-foreground">{fila.titulo}</h3>
        <span
          className={cn(
            "flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase",
            esPresencial ? "bg-success/12 text-success" : "bg-primary/10 text-primary"
          )}
        >
          {esPresencial ? <MapPin className="h-3 w-3" /> : <MonitorPlay className="h-3 w-3" />}
          {TRAINING_MODALITY_LABELS[fila.modalidad]}
        </span>
      </div>

      {fila.proximaSesion && (
        <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <CalendarClock className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
          {fila.proximaSesion.etiqueta}
          {fila.proximaSesion.lugar ? ` · ${fila.proximaSesion.lugar}` : ""}
        </p>
      )}

      {/* Stepper del ciclo */}
      <ol className="flex flex-wrap items-center gap-1.5">
        {fila.pasos
          .filter((p) => p.estado !== "no-aplica")
          .map((p, i, lista) => (
            <li key={p.clave} className="flex items-center gap-1.5">
              <Paso paso={p} />
              {i < lista.length - 1 && <span className="h-px w-3 bg-border" aria-hidden="true" />}
            </li>
          ))}
      </ol>

      <PieAccion accion={fila.accion} cerrada={fila.cerrada} />
    </article>
  );
}

function Paso({ paso }: { paso: PasoCiclo }) {
  const nota = paso.nota != null ? `${paso.nota}%` : null;
  const colorNota =
    paso.nota == null
      ? ""
      : paso.nota >= 85
        ? "text-success"
        : paso.nota >= 70
          ? "text-warning-foreground"
          : "text-destructive";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold",
        paso.estado === "hecho"
          ? "border-success/40 bg-success/8 text-foreground"
          : paso.estado === "disponible"
            ? "border-primary/50 bg-primary/10 text-primary"
            : "border-border/60 bg-card/40 text-muted-foreground"
      )}
      title={paso.detalle}
    >
      {paso.estado === "hecho" ? (
        <Check className="h-3 w-3 text-success" aria-hidden="true" />
      ) : (
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            paso.estado === "disponible" ? "animate-pulse bg-primary" : "border border-muted-foreground/50"
          )}
          aria-hidden="true"
        />
      )}
      {paso.etiqueta}
      {nota && <span className={cn("font-bold tabular-nums", colorNota)}>{nota}</span>}
    </span>
  );
}

function PieAccion({ accion, cerrada }: { accion: AccionTablero; cerrada: boolean }) {
  if (!accion) {
    return (
      <p className="mt-auto text-[12px] font-semibold text-muted-foreground">
        {cerrada ? "Jornada cerrada · consulta" : "Al día por ahora"}
      </p>
    );
  }

  if (accion.tipo === "encuesta") {
    return (
      <Link
        href={`/e/${accion.slug}`}
        className="mt-auto inline-flex w-fit items-center gap-1.5 rounded-xl bg-gradient-to-r from-primary to-success px-4 py-2 text-[12.5px] font-bold text-white shadow-md shadow-primary/20 transition-transform hover:translate-x-0.5"
      >
        <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />
        {accion.etiqueta}
      </Link>
    );
  }

  if (accion.tipo === "sesion") {
    return (
      <p className="mt-auto flex items-center gap-1.5 text-[12px] font-semibold text-primary">
        <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
        {accion.etiqueta}: {accion.detalle}
      </p>
    );
  }

  return (
    // Un <a> plano a propósito: el resolver /c/ es la puerta única (valida
    // ventana, inscribe bajo demanda y congela el momento). Sin prefetch:
    // un <Link> lo dispararía al pintar y eso ya inscribiría a la persona.
    <a
      href={`/c/${accion.activityId}/${accion.tipo}`}
      className="mt-auto inline-flex w-fit items-center gap-1.5 rounded-xl bg-gradient-to-r from-primary to-success px-4 py-2 text-[12.5px] font-bold text-white shadow-md shadow-primary/20 transition-transform hover:translate-x-0.5"
    >
      {accion.etiqueta}
    </a>
  );
}
