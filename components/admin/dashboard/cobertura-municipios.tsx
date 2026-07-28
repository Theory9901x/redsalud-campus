import Link from "next/link";
import { MapPin } from "lucide-react";
import { EmptyState } from "@/components/brand/empty-state";
import { getCoberturaMunicipios } from "@/lib/admin-dashboard";
import type { FiltrosPanel } from "@/lib/admin-dashboard";

/**
 * Ordenado de menor a mayor cumplimiento: la primera fila es donde hay que
 * intervenir. Cada fila lleva su fracción escrita al lado de la barra, no
 * solo el color, porque una barra corta y una barra vacía se confunden.
 */
export async function CoberturaMunicipios({
  filtros,
  municipios,
}: {
  filtros: FiltrosPanel;
  municipios: { id: string; nombre: string }[];
}) {
  const filas = await getCoberturaMunicipios(filtros);

  if (filas.length === 0) {
    return (
      <EmptyState
        icon={MapPin}
        title="Sin datos de cobertura"
        description="Aparecerá cuando haya personal con municipio y cursos asignados."
      />
    );
  }

  const idPorNombre = new Map(municipios.map((m) => [m.nombre, m.id]));

  return (
    <ul className="space-y-2.5">
      {filas.map((fila) => {
        const pct = fila.personas > 0 ? Math.round((fila.completaron / fila.personas) * 100) : 0;
        const id = idPorNombre.get(fila.municipio);
        // El color va de rojo a verde según cumplimiento; el número al lado
        // dice lo mismo sin depender del color.
        const color = pct >= 70 ? "var(--data-1)" : pct >= 35 ? "var(--data-5)" : "var(--data-4)";

        const contenido = (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-sm text-foreground">{fila.municipio}</span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {fila.completaron}/{fila.personas} · <span className="font-semibold text-foreground">{pct}%</span>
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
            </div>
          </>
        );

        return (
          <li key={fila.municipio}>
            {id ? (
              <Link
                href={`/admin?municipio=${id}`}
                className="block rounded-lg px-2 py-1 transition-colors hover:bg-muted/60"
              >
                {contenido}
              </Link>
            ) : (
              <div className="px-2 py-1">{contenido}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
