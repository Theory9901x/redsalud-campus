"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Activity, Layers, RotateCcw, Search, Tag, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type Faceta = {
  paramName: string;
  titulo: string;
  opciones: { valor: string; etiqueta: string; conteo: number }[];
};

/** Ícono de cada grupo de facetas, para que se distingan de un vistazo. */
const ICONO_FACETA: Record<string, LucideIcon> = {
  categoria: Tag,
  tipo: Layers,
  estado: Activity,
};

/**
 * Filtros del catálogo por facetas combinables. Los contadores se calculan en
 * el servidor y llegan por props; el cliente solo navega. Cada faceta es
 * multi-selección y se acumula en la URL separada por comas, así el estado del
 * filtro es compartible y sobrevive a recargas.
 */
export function FiltrosCatalogo({ facetas, total }: { facetas: Faceta[]; total: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pendiente, startTransition] = useTransition();

  const seleccionados = (param: string) => (searchParams.get(param) ?? "").split(",").filter(Boolean);

  function alternar(param: string, valor: string) {
    const actuales = seleccionados(param);
    const nuevos = actuales.includes(valor) ? actuales.filter((v) => v !== valor) : [...actuales, valor];
    const params = new URLSearchParams(searchParams.toString());
    if (nuevos.length > 0) params.set(param, nuevos.join(","));
    else params.delete(param);
    startTransition(() => router.replace(`?${params.toString()}`, { scroll: false }));
  }

  function limpiar() {
    startTransition(() => router.replace("?", { scroll: false }));
  }

  const activos = facetas.flatMap((f) =>
    seleccionados(f.paramName).map((valor) => ({
      param: f.paramName,
      valor,
      etiqueta: f.opciones.find((o) => o.valor === valor)?.etiqueta ?? valor,
    }))
  );
  const busqueda = searchParams.get("q") ?? "";
  const hayFiltros = activos.length > 0 || busqueda.length > 0;

  return (
    <div className={cn("surface-glass overflow-hidden", pendiente && "opacity-70")}>
      {/* Fila 1: buscador ancho + limpiar. */}
      <div className="flex items-center gap-3 border-b border-border/60 p-4 sm:p-5">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            defaultValue={busqueda}
            placeholder="Buscar cursos, temas o habilidades..."
            onChange={(e) => {
              const params = new URLSearchParams(searchParams.toString());
              if (e.target.value.trim()) params.set("q", e.target.value.trim());
              else params.delete("q");
              startTransition(() => router.replace(`?${params.toString()}`, { scroll: false }));
            }}
            className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-[var(--accent)]/50 focus-visible:ring-2 focus-visible:ring-[var(--accent)]/15"
          />
        </div>
        {hayFiltros && (
          <button
            type="button"
            onClick={limpiar}
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border border-border px-4 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <RotateCcw className="h-4 w-4" />
            <span className="hidden sm:inline">Limpiar filtros</span>
          </button>
        )}
      </div>

      {/* Fila 2: grupos de facetas separados por divisores verticales. */}
      <div className="grid grid-cols-1 divide-y divide-border/60 md:grid-cols-3 md:divide-x md:divide-y-0">
        {facetas.map((faceta) => {
          const Icono = ICONO_FACETA[faceta.paramName] ?? Tag;
          return (
            <div key={faceta.paramName} className="p-4 sm:p-5">
              <p className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Icono className="h-3.5 w-3.5 text-[var(--accent)]" />
                {faceta.titulo}
              </p>
              <div className="flex flex-wrap gap-2">
                {faceta.opciones.map((op) => {
                  const activo = seleccionados(faceta.paramName).includes(op.valor);
                  const vacio = op.conteo === 0 && !activo;
                  return (
                    <button
                      key={op.valor}
                      type="button"
                      onClick={() => alternar(faceta.paramName, op.valor)}
                      disabled={vacio}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-200 focus-visible:outline-2 focus-visible:outline-[var(--accent)]",
                        activo
                          ? "border-[var(--accent)]/40 bg-[var(--accent)]/15 font-semibold text-[var(--accent)]"
                          : vacio
                            ? "cursor-not-allowed border-border/60 text-muted-foreground/40"
                            : "border-border bg-card text-foreground/80 hover:border-[var(--accent)]/40 hover:text-foreground"
                      )}
                    >
                      {op.etiqueta}
                      <span className={cn(activo ? "text-[var(--accent)]/70" : "text-muted-foreground/60")}>
                        {op.conteo}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Fila 3: filtros activos removibles. */}
      {hayFiltros && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border/60 p-4 sm:px-5">
          <span className="text-xs text-muted-foreground">
            {total} {total === 1 ? "resultado" : "resultados"}
          </span>
          {activos.map((a) => (
            <button
              key={`${a.param}-${a.valor}`}
              type="button"
              onClick={() => alternar(a.param, a.valor)}
              className="inline-flex items-center gap-1 rounded-full bg-[var(--accent)]/12 px-2.5 py-1 text-xs font-medium text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/20"
            >
              {a.etiqueta}
              <X className="h-3 w-3" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
