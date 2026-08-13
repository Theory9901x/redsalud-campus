"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  Search,
  ChevronDown,
  Eye,
  Video,
  CalendarClock,
  ClipboardCheck,
  GraduationCap,
  BookOpen,
  Award,
  ArrowRight,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Fila del cronograma del estudiante, ya resuelta en el servidor: aquí no se
 * calcula ningún estado, solo se filtra y se pinta. Todo lo que se muestra
 * sale de datos reales -ventanas del ciclo, intentos propios, inscripción-;
 * nada de estados simulados.
 */
export type FilaCronograma = {
  id: string;
  titulo: string;
  programa: string | null;
  area: string;
  areaOrden: number;
  /** Trimestre bajo el que se lista hoy (1-4); 0 = sin programar. Ver trimestreParaListar. */
  trimestre: number;
  programacion: string;
  modalidad: string | null;
  publico: string;
  conContenido: boolean;
  inscrito: boolean;
  progreso: number | null;
  estadoGeneral: "Completada" | "En curso" | "Presaber disponible" | "Postsaber disponible" | "Programada" | "Sin contenido";
  presaber: "Realizado" | "Disponible" | "Pendiente" | "Cerrado" | null;
  postsaber: "Realizado" | "Disponible" | "Bloqueado" | "Cerrado" | null;
  /**
   * "entrar" inscribe bajo demanda y resuelve el destino en el servidor
   * (mismo camino que el QR); "enlace" es pura consulta y no crea nada.
   */
  accion:
    | { tipo: "entrar"; etiqueta: string; activityId: string }
    | { tipo: "enlace"; etiqueta: string; href: string }
    | null;
};

export type AccionProxima = { tipo: string; titulo: string; detalle: string; activityId: string | null };
export type SesionVirtual = { titulo: string; fecha: string; meetingUrl: string };

const CHIPS = [
  "Todos",
  "Presaber disponible",
  "Postsaber disponible",
  "En curso",
  "Completadas",
  "Sin contenido",
] as const;
type Chip = (typeof CHIPS)[number];

/** Acento de cada trimestre: categóricos del sistema, nunca hex sueltos. */
const TRIMESTRE_VAR: Record<number, string> = { 1: "--data-2", 2: "--data-1", 3: "--data-3", 4: "--data-5" };
const ROMANO = ["I", "II", "III", "IV"];

/*
 * La rejilla de la fila, en un solo sitio: la usan la cabecera de columnas y
 * cada capacitación, así que no pueden quedar desalineadas. El título pesa
 * más que el resto porque es lo que se lee; antes las cuatro columnas del
 * medio medían igual y apretaban el nombre de la capacitación.
 */
const REJILLA_FILA =
  "grid grid-cols-1 gap-x-5 gap-y-2 px-5 lg:grid-cols-[minmax(0,2.6fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1.2fr)_auto] lg:items-center";

const BADGE: Record<string, string> = {
  Completada: "bg-success/10 text-success",
  Realizado: "bg-success/10 text-success",
  "En curso": "bg-primary/10 text-primary",
  Disponible: "bg-success/15 text-success",
  "Presaber disponible": "bg-warning/15 text-warning",
  "Postsaber disponible": "bg-primary/10 text-primary",
  Programada: "bg-primary/10 text-primary",
  Pendiente: "bg-warning/15 text-warning",
  Bloqueado: "bg-muted text-muted-foreground",
  Cerrado: "bg-muted text-muted-foreground",
  "Sin contenido": "bg-muted text-muted-foreground",
};

function Badge({ texto }: { texto: string | null }) {
  if (!texto) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap", BADGE[texto] ?? "bg-muted text-muted-foreground")}>
      {texto}
    </span>
  );
}

/**
 * Botón de entrada a una capacitación. Es un formulario y no un enlace
 * porque la entrada CREA la inscripción: un <Link> lo prefetchea el navegador
 * con solo pasar el cursor, e inscribiría a quien nunca hizo clic.
 */
function BotonEntrar({
  etiqueta,
  activityId,
  onEntrar,
  className,
}: {
  etiqueta: string;
  activityId: string;
  onEntrar: (activityId: string) => Promise<void>;
  className?: string;
}) {
  const [entrando, iniciar] = useTransition();
  return (
    <button
      type="button"
      disabled={entrando}
      onClick={() => iniciar(async () => { await onEntrar(activityId); })}
      className={cn("inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60", className)}
    >
      {etiqueta}
      {entrando ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
      ) : (
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      )}
    </button>
  );
}

export function CronogramaEstudiante({
  filas,
  acciones,
  sesionesVirtuales,
  onEntrar,
}: {
  filas: FilaCronograma[];
  acciones: AccionProxima[];
  sesionesVirtuales: SesionVirtual[];
  /** Server action ya ligada al plan: inscribe bajo demanda y redirige. */
  onEntrar: (activityId: string) => Promise<void>;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [chip, setChip] = useState<Chip>("Todos");
  const [area, setArea] = useState("TODAS");
  // El primer trimestre con algo disponible arranca abierto; el resto cerrado.
  const [abiertos, setAbiertos] = useState<Set<number>>(() => {
    const conAccion = filas.find((f) => f.accion)?.trimestre ?? filas[0]?.trimestre ?? 1;
    return new Set([conAccion]);
  });

  const areas = useMemo(() => [...new Set(filas.map((f) => f.area))].sort((a, b) => a.localeCompare(b, "es")), [filas]);

  const filtradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return filas.filter((f) => {
      if (area !== "TODAS" && f.area !== area) return false;
      if (chip === "Presaber disponible" && f.presaber !== "Disponible") return false;
      if (chip === "Postsaber disponible" && f.postsaber !== "Disponible") return false;
      if (chip === "En curso" && f.estadoGeneral !== "En curso") return false;
      if (chip === "Completadas" && f.estadoGeneral !== "Completada") return false;
      if (chip === "Sin contenido" && f.conContenido) return false;
      if (texto && !`${f.titulo} ${f.area} ${f.programa ?? ""}`.toLowerCase().includes(texto)) return false;
      return true;
    });
  }, [filas, busqueda, chip, area]);

  const porTrimestre = useMemo(() => {
    const grupos = new Map<number, FilaCronograma[]>();
    for (const f of filtradas) {
      const lista = grupos.get(f.trimestre) ?? [];
      lista.push(f);
      grupos.set(f.trimestre, lista);
    }
    for (const lista of grupos.values()) {
      lista.sort((a, b) => a.areaOrden - b.areaOrden || a.titulo.localeCompare(b.titulo, "es"));
    }
    return grupos;
  }, [filtradas]);

  function alternar(t: number) {
    setAbiertos((prev) => {
      const s = new Set(prev);
      if (s.has(t)) s.delete(t);
      else s.add(t);
      return s;
    });
  }

  const hayFiltro = busqueda.trim() !== "" || chip !== "Todos" || area !== "TODAS";

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0 space-y-4">
        {/* Búsqueda y filtros */}
        <div className="surface-lumen flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar en el cronograma…"
              className="rounded-full border-border/60 bg-card/70 pl-9"
            />
          </div>
          <select
            value={area}
            onChange={(e) => setArea(e.target.value)}
            className="h-9 rounded-full border border-border/60 bg-card/70 px-3.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            aria-label="Filtrar por área"
          >
            <option value="TODAS">Todas las áreas</option>
            {areas.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {CHIPS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setChip(c)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
                chip === c
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "border border-border/60 bg-card/70 text-muted-foreground backdrop-blur-sm hover:text-foreground"
              )}
            >
              {c}
            </button>
          ))}
          {hayFiltro && (
            <button
              type="button"
              onClick={() => {
                setBusqueda("");
                setChip("Todos");
                setArea("TODAS");
              }}
              className="text-xs font-medium text-primary hover:underline"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {hayFiltro && (
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {filtradas.length} de {filas.length} capacitaciones
          </p>
        )}

        {/* Trimestres */}
        {[1, 2, 3, 4].map((t) => {
          const items = porTrimestre.get(t) ?? [];
          const abierto = abiertos.has(t);
          const acento = `var(${TRIMESTRE_VAR[t]})`;
          return (
            <section key={t} className="surface-lumen overflow-hidden p-0">
              <button
                type="button"
                onClick={() => alternar(t)}
                aria-expanded={abierto}
                className="flex w-full items-center gap-3.5 px-5 py-4 text-left"
                style={{ backgroundImage: `linear-gradient(90deg, color-mix(in oklch, ${acento} 14%, transparent), transparent 70%)` }}
              >
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: acento }} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-[15px] font-bold text-foreground">Trimestre {ROMANO[t - 1]}</span>
                  <span className="block text-xs text-muted-foreground">
                    Capacitaciones programadas para el {["primer", "segundo", "tercer", "cuarto"][t - 1]} trimestre
                  </span>
                </span>
                <span
                  className="rounded-full px-3 py-1 text-[11px] font-bold"
                  style={{ backgroundColor: `color-mix(in oklch, ${acento} 15%, transparent)`, color: acento }}
                >
                  {items.length} {items.length === 1 ? "plan" : "planes"}
                </span>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/60 bg-card/70">
                  <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", abierto && "rotate-180")} />
                </span>
              </button>

              {abierto && items.length > 0 && (
                <>
                <div
                  className={cn(REJILLA_FILA, "hidden border-t border-border/60 bg-foreground/[0.02] py-2.5 lg:grid")}
                  aria-hidden="true"
                >
                  <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Capacitación</span>
                  <span className="text-center text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Modalidad</span>
                  <span className="text-center text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Dirigido a</span>
                  <span className="text-center text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Presaber</span>
                  <span className="text-center text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Postsaber</span>
                  <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Estado</span>
                  <span />
                </div>
                <ul className="divide-y divide-border/60 border-t border-border/60">
                  {items.map((f) => (
                    <li key={f.id} className={cn(REJILLA_FILA, "py-3.5 transition-colors hover:bg-foreground/[0.02]")}>
                      <div className="min-w-0">
                        <p className="text-[13px] font-bold leading-snug text-foreground">{f.titulo}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                          <span>{f.area}</span>
                          {f.programa && (
                            <span className="rounded-full bg-primary/10 px-1.5 py-px font-semibold text-primary">{f.programa}</span>
                          )}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground lg:text-center">{f.modalidad ?? "—"}</p>
                      <p className="text-xs text-muted-foreground lg:text-center">{f.publico}</p>
                      <div className="lg:text-center">
                        <Badge texto={f.presaber} />
                      </div>
                      <div className="lg:text-center">
                        <Badge texto={f.postsaber} />
                      </div>
                      <div>
                        {f.progreso !== null ? (
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                              <div className="h-full rounded-full bg-primary" style={{ width: `${f.progreso}%` }} />
                            </div>
                            <span className="text-[11px] font-semibold text-foreground">{f.progreso}%</span>
                          </div>
                        ) : (
                          <Badge texto={f.estadoGeneral} />
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {f.accion?.tipo === "entrar" ? (
                          <BotonEntrar
                            etiqueta={f.accion.etiqueta}
                            activityId={f.accion.activityId}
                            onEntrar={onEntrar}
                          />
                        ) : f.accion ? (
                          <Link
                            href={f.accion.href}
                            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
                          >
                            {f.accion.etiqueta}
                            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                          </Link>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground" title="El contenido se está preparando">
                            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                            {f.programacion}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
                </>
              )}
              {abierto && items.length === 0 && (
                <p className="border-t border-border px-4 py-6 text-center text-sm text-muted-foreground">
                  Nada programado en este trimestre{hayFiltro ? " con el filtro activo" : ""}.
                </p>
              )}
            </section>
          );
        })}
      </div>

      {/* Panel derecho */}
      <aside className="space-y-5">
        <section className="surface-glass space-y-2.5 p-5">
          <h2 className="font-display text-xs font-bold uppercase tracking-wide text-foreground">Accesos rápidos</h2>
          {[
            { icono: BookOpen, titulo: "Mis cursos", detalle: "Continúa donde ibas", href: "/mi-aula", chip: "bg-primary/15 text-primary" },
            { icono: Award, titulo: "Mis certificados", detalle: "Descárgalos en PDF", href: "/mis-certificados", chip: "bg-[var(--accent)]/15 text-[var(--accent)]" },
            { icono: ClipboardCheck, titulo: "Evaluaciones", detalle: "Presaber, postsaber y encuestas", href: "/evaluaciones", chip: "bg-success/15 text-success" },
            { icono: GraduationCap, titulo: "Catálogo", detalle: "Explora la oferta", href: "/cursos", chip: "bg-warning/15 text-warning-foreground" },
          ].map((a) => (
            <Link key={a.href} href={a.href} className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-accent/10">
              <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", a.chip)}>
                <a.icono className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-bold text-foreground">{a.titulo}</span>
                <span className="block text-[11px] text-muted-foreground">{a.detalle}</span>
              </span>
            </Link>
          ))}
        </section>

        <section className="surface-glass space-y-3 p-5">
          <h2 className="font-display text-xs font-bold uppercase tracking-wide text-foreground">Próximas acciones</h2>
          {acciones.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nada pendiente por ahora. Cuando se habilite una evaluación o se agende una jornada, aparece aquí.</p>
          ) : (
            acciones.map((a, i) => (
              <div key={i} className="surface-clay p-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-primary">{a.tipo}</p>
                <p className="mt-0.5 text-[13px] font-semibold leading-snug text-foreground">{a.titulo}</p>
                <p className="text-[11px] text-muted-foreground">{a.detalle}</p>
                {a.activityId && (
                  <BotonEntrar etiqueta="Ir ahora" activityId={a.activityId} onEntrar={onEntrar} className="mt-1.5" />
                )}
              </div>
            ))
          )}
        </section>

        <section className="surface-glass space-y-3 p-5">
          <h2 className="flex items-center gap-1.5 font-display text-xs font-bold uppercase tracking-wide text-foreground">
            <Video className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            Sesiones virtuales
          </h2>
          {sesionesVirtuales.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Sin sesiones virtuales agendadas. Cuando tu área programe una jornada virtual con enlace, aparece aquí.
            </p>
          ) : (
            sesionesVirtuales.map((s, i) => (
              <div key={i} className="surface-clay p-3">
                <p className="text-[13px] font-semibold leading-snug text-foreground">{s.titulo}</p>
                <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <CalendarClock className="h-3 w-3" aria-hidden="true" />
                  {s.fecha}
                </p>
                <a
                  href={s.meetingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground hover:opacity-90"
                >
                  Ingresar a la sesión
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              </div>
            ))
          )}
        </section>
      </aside>
    </div>
  );
}
