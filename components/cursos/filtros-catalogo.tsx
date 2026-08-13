"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Activity, Check, ChevronDown, Layers, RotateCcw, Search, Tag, X, type LucideIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
 * Filtros del catálogo por facetas combinables.
 *
 * Cada faceta vive dentro de un desplegable en lugar de desplegar todas sus
 * opciones a la vista. Antes el panel crecía con el catálogo -una fila más de
 * fichas por cada categoría nueva- y acababa empujando los cursos, que son lo
 * que la gente vino a ver, por debajo del pliegue. Con el desplegable la
 * barra ocupa siempre lo mismo, haya ocho categorías o cuarenta.
 *
 * Lo que sí queda a la vista es lo que está aplicado: los filtros activos
 * siguen abajo como fichas removibles, porque un filtro que no se ve es un
 * filtro que se olvida y hace pensar que faltan cursos.
 *
 * Los contadores se calculan en el servidor y llegan por props; el cliente
 * solo navega. Cada faceta es multi-selección y se acumula en la URL separada
 * por comas, así el estado del filtro es compartible y sobrevive a recargas.
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

  function limpiarFaceta(param: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(param);
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
    <div className={cn("surface-lumen overflow-visible", pendiente && "opacity-70")}>
      <div className="flex flex-col gap-3 p-4 sm:p-5 lg:flex-row lg:items-center">
        {/* Buscador: sigue siendo lo primero y lo más ancho. */}
        <div className="relative min-w-[220px] flex-1">
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

        {/* Un desplegable por faceta: alto constante, crezca lo que crezca el catálogo. */}
        <div className="flex flex-wrap items-center gap-2">
          {facetas.map((faceta) => {
            const Icono = ICONO_FACETA[faceta.paramName] ?? Tag;
            const elegidos = seleccionados(faceta.paramName);
            // Se listan TODAS, con las vacías deshabilitadas: dentro de un
            // desplegable el espacio ya no aprieta, y ocultarlas dejaría el
            // panel en blanco justo cuando el catálogo aún no tiene cursos en
            // ninguna categoría -parecería roto, no vacío-.
            const opciones = faceta.opciones;
            return (
              <Popover key={faceta.paramName}>
                <PopoverTrigger
                  className={cn(
                    "inline-flex h-11 items-center gap-2 rounded-xl border px-3.5 text-[13px] font-medium outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]",
                    elegidos.length > 0
                      ? "border-[var(--accent)]/45 bg-[var(--accent)]/12 text-[var(--accent)]"
                      : "border-border bg-card text-foreground/80 hover:border-[var(--accent)]/40 hover:text-foreground"
                  )}
                >
                  <Icono className="h-4 w-4" aria-hidden="true" />
                  {faceta.titulo}
                  {elegidos.length > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[11px] font-bold leading-none text-white">
                      {elegidos.length}
                    </span>
                  )}
                  <ChevronDown className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
                </PopoverTrigger>

                <PopoverContent align="start" className="w-[min(20rem,calc(100vw-2rem))]">
                  <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <p className="font-display text-sm font-bold text-foreground">{faceta.titulo}</p>
                    {elegidos.length > 0 && (
                      <button
                        type="button"
                        onClick={() => limpiarFaceta(faceta.paramName)}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        Quitar
                      </button>
                    )}
                  </div>

                  {/* Con muchas categorías el panel desplaza; la barra no crece. */}
                  <div className="max-h-72 overflow-y-auto p-1.5">
                    {opciones.length === 0 ? (
                      <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                        Todavía no hay opciones para filtrar.
                      </p>
                    ) : (
                      opciones.map((op) => {
                        const activo = elegidos.includes(op.valor);
                        const vacio = op.conteo === 0 && !activo;
                        return (
                          <button
                            key={op.valor}
                            type="button"
                            onClick={() => alternar(faceta.paramName, op.valor)}
                            aria-pressed={activo}
                            disabled={vacio}
                            className={cn(
                              "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors",
                              activo
                                ? "bg-[var(--accent)]/12 font-semibold text-[var(--accent)]"
                                : vacio
                                  ? "cursor-not-allowed text-muted-foreground/45"
                                  : "text-foreground/85 hover:bg-muted"
                            )}
                          >
                            <span
                              className={cn(
                                "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                                activo ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-border/70"
                              )}
                              aria-hidden="true"
                            >
                              {activo && <Check className="h-3 w-3" strokeWidth={3} />}
                            </span>
                            <span className="min-w-0 flex-1 truncate">{op.etiqueta}</span>
                            <span className="shrink-0 text-xs text-muted-foreground">{op.conteo}</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            );
          })}

          {hayFiltros && (
            <button
              type="button"
              onClick={limpiar}
              className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border border-border px-3.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
            >
              <RotateCcw className="h-4 w-4" />
              <span className="hidden sm:inline">Limpiar</span>
            </button>
          )}
        </div>
      </div>

      {/* Lo aplicado, siempre a la vista: un filtro escondido se olvida. */}
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
