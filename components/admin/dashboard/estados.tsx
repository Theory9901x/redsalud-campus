"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Estados compartidos por todos los widgets del panel.
 *
 * Cada widget se envuelve en su propio <Suspense> con CargandoLista/CargandoKpis
 * y en su propia <ErrorWidget> a través de error.tsx: si una consulta falla o
 * va lenta, degrada ese widget y no la página entera. Antes bastaba con que una
 * de las ocho consultas del Promise.all reventara para dejar el panel en blanco.
 */

export function CargandoKpis() {
  return (
    <div className="grid-densidad">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="surface-clay flex items-center gap-3 px-4 py-4">
          <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-6 w-14" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CargandoLista({ filas = 4 }: { filas?: number }) {
  return (
    <div className="space-y-3" aria-busy="true">
      {Array.from({ length: filas }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-12" />
          </div>
          <Skeleton className="h-1.5 w-full rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function CargandoTabla({ filas = 6 }: { filas?: number }) {
  return (
    <div className="space-y-2" aria-busy="true">
      {Array.from({ length: filas }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-1.5">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-28" />
          </div>
          <Skeleton className="h-4 w-24 shrink-0" />
          <Skeleton className="h-4 w-10 shrink-0" />
        </div>
      ))}
    </div>
  );
}

/** Estado de error de un widget: dice qué pasó y deja reintentar solo eso. */
export function ErrorWidget({ reintentar }: { reintentar?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-destructive/40 bg-destructive/5 px-4 py-6 text-center">
      <AlertTriangle className="h-5 w-5 text-destructive" />
      <p className="text-sm font-medium text-foreground">No se pudo cargar este dato</p>
      <p className="max-w-xs text-xs text-muted-foreground">
        El resto del panel sigue siendo válido. Si vuelve a fallar, puede ser la conexión con la base de datos.
      </p>
      {reintentar && (
        <button
          type="button"
          onClick={reintentar}
          className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reintentar
        </button>
      )}
    </div>
  );
}
