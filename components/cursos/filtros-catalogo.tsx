"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type Faceta = {
  paramName: string;
  titulo: string;
  opciones: { valor: string; etiqueta: string; conteo: number }[];
};

/**
 * Filtros del catálogo por facetas combinables (Fase 7.6). Sustituye los chips
 * planos de categoría, que no escalaban y no decían cuántos cursos había
 * detrás de cada opción.
 *
 * Los contadores se calculan en el servidor y llegan por props: el cliente
 * solo navega. Cada faceta es multi-selección y se acumula en la URL separada
 * por comas, así el estado del filtro es compartible y sobrevive a recargas.
 *
 * No hay faceta por cargo a propósito: para el catálogo lo único que decide
 * qué cursos corresponden es el grupo poblacional (asistencial/administrativo),
 * ya cubierto por Course.targetAudience. El cargo no filtra formación.
 */
export function FiltrosCatalogo({ facetas, total }: { facetas: Faceta[]; total: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pendiente, startTransition] = useTransition();

  function seleccionados(param: string) {
    return (searchParams.get(param) ?? "").split(",").filter(Boolean);
  }

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

  // Chips de lo que está activo ahora mismo, para poder quitarlo de a uno.
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
    <div className={cn("surface-glass space-y-4 p-4 sm:p-5", pendiente && "opacity-70")}>
      <div className="flex items-center gap-2 rounded-full border border-border/80 bg-[var(--glass-bg)] px-4 py-2 shadow-inner focus-within:border-primary/40 focus-within:ring-3 focus-within:ring-ring/20">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          type="search"
          defaultValue={busqueda}
          placeholder="Buscar cursos..."
          onChange={(e) => {
            const params = new URLSearchParams(searchParams.toString());
            if (e.target.value.trim()) params.set("q", e.target.value.trim());
            else params.delete("q");
            startTransition(() => router.replace(`?${params.toString()}`, { scroll: false }));
          }}
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {facetas.map((faceta) => (
          <div key={faceta.paramName}>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              {faceta.titulo}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {faceta.opciones.map((op) => {
                const activo = seleccionados(faceta.paramName).includes(op.valor);
                return (
                  <button
                    key={op.valor}
                    type="button"
                    onClick={() => alternar(faceta.paramName, op.valor)}
                    disabled={op.conteo === 0 && !activo}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium transition-all duration-200 focus-visible:outline-2 focus-visible:outline-primary",
                      activo
                        ? "surface-clay-pressed font-semibold text-primary outline outline-2 outline-primary/25"
                        : op.conteo === 0
                          ? "cursor-not-allowed border border-border bg-transparent text-muted-foreground/40"
                          : "surface-clay text-foreground/70 hover:-translate-y-0.5 hover:text-foreground"
                    )}
                  >
                    {op.etiqueta} <span className="text-muted-foreground">({op.conteo})</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {hayFiltros && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
          <span className="text-xs text-muted-foreground">
            {total} {total === 1 ? "curso" : "cursos"} ·
          </span>
          {activos.map((a) => (
            <button
              key={`${a.param}-${a.valor}`}
              type="button"
              onClick={() => alternar(a.param, a.valor)}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20"
            >
              {a.etiqueta}
              <X className="h-3 w-3" />
            </button>
          ))}
          <button
            type="button"
            onClick={limpiar}
            className="ml-auto text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            Limpiar todo
          </button>
        </div>
      )}
    </div>
  );
}
