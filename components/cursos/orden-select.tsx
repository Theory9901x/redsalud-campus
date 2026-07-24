"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

/**
 * Selector de orden del catálogo. El orden se resuelve en el SERVIDOR: este
 * control solo escribe el parámetro `orden` en la URL y deja que la página se
 * vuelva a renderizar con la lista ya ordenada, así el estado es compartible
 * y sobrevive a recargas (igual que los filtros).
 */
const OPCIONES_CATALOGO = [
  { valor: "reciente", etiqueta: "Más recientes" },
  { valor: "nombre", etiqueta: "Nombre A-Z" },
  { valor: "duracion", etiqueta: "Duración" },
];

export function OrdenSelect({
  opciones = OPCIONES_CATALOGO,
}: {
  /** Opciones de orden; el primer valor es el predeterminado y no ensucia la URL. */
  opciones?: { valor: string; etiqueta: string }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pendiente, startTransition] = useTransition();
  const predeterminado = opciones[0].valor;
  const actual = searchParams.get("orden") ?? predeterminado;

  return (
    <label className="flex items-center gap-2.5 text-[13px] text-muted-foreground">
      <span className="hidden sm:inline">Ordenar por:</span>
      <select
        value={actual}
        disabled={pendiente}
        onChange={(e) => {
          const params = new URLSearchParams(searchParams.toString());
          if (e.target.value === predeterminado) params.delete("orden");
          else params.set("orden", e.target.value);
          startTransition(() => router.replace(`?${params.toString()}`, { scroll: false }));
        }}
        className="h-9 rounded-xl border border-border bg-card px-3 text-[13px] text-foreground outline-none focus-visible:border-[var(--accent)]/50 focus-visible:ring-2 focus-visible:ring-[var(--accent)]/15"
      >
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.etiqueta}
          </option>
        ))}
      </select>
    </label>
  );
}
