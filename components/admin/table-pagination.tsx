"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Tamaños de página disponibles. */
export const PAGE_SIZES = [20, 50, 100, 500, 1000] as const;
export const DEFAULT_PAGE_SIZE = 20;

/**
 * Paginación de listados largos. Conserva los filtros actuales (opera sobre
 * los searchParams existentes) y al cambiar el tamaño vuelve a la página 1,
 * porque el offset anterior deja de tener sentido con otro tamaño.
 */
export function TablePagination({
  total,
  page,
  pageSize,
}: {
  total: number;
  page: number;
  pageSize: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const desde = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const hasta = Math.min(page * pageSize, total);

  function navegar(cambios: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [clave, valor] of Object.entries(cambios)) params.set(clave, valor);
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <label htmlFor="pageSize" className="whitespace-nowrap">
          Mostrar
        </label>
        <select
          id="pageSize"
          value={pageSize}
          onChange={(e) => navegar({ pageSize: e.target.value, page: "1" })}
          className="h-8 rounded-lg border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
        <span className="whitespace-nowrap">
          registros · {desde}–{hasta} de {total}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => navegar({ page: String(page - 1) })}
          className={cn(
            "flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-sm transition-colors",
            page <= 1 ? "cursor-not-allowed opacity-40" : "hover:bg-muted"
          )}
        >
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </button>
        <span className="px-2 text-sm text-muted-foreground">
          Página {page} de {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => navegar({ page: String(page + 1) })}
          className={cn(
            "flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-sm transition-colors",
            page >= totalPages ? "cursor-not-allowed opacity-40" : "hover:bg-muted"
          )}
        >
          Siguiente
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
