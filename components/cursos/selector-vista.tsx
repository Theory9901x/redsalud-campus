"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";

export type VistaCatalogo = "cuadricula" | "lista";

/**
 * Cuadrícula o lista.
 *
 * Va en la URL igual que los filtros y el orden: así el catálogo se comparte
 * tal y como se está viendo, y volver atrás recupera la vista anterior. Un
 * estado local se perdería en cada navegación.
 */
export function SelectorVista({ vista }: { vista: VistaCatalogo }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function cambiar(nueva: VistaCatalogo) {
    const params = new URLSearchParams(searchParams.toString());
    // "cuadricula" es el valor por defecto: no ensucia la URL.
    if (nueva === "cuadricula") params.delete("vista");
    else params.set("vista", nueva);
    router.push(`/cursos${params.toString() ? `?${params}` : ""}`, { scroll: false });
  }

  const opciones: { valor: VistaCatalogo; etiqueta: string; icono: typeof LayoutGrid }[] = [
    { valor: "cuadricula", etiqueta: "Cuadrícula", icono: LayoutGrid },
    { valor: "lista", etiqueta: "Lista", icono: List },
  ];

  return (
    <div
      className="surface-inset flex gap-1 p-1"
      role="group"
      aria-label="Cambiar la forma de ver el catálogo"
    >
      {opciones.map(({ valor, etiqueta, icono: Icono }) => {
        const activa = vista === valor;
        return (
          <button
            key={valor}
            type="button"
            onClick={() => cambiar(valor)}
            aria-pressed={activa}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors",
              activa
                ? "bg-gradient-to-br from-[var(--accent)] to-primary text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icono className="h-3.5 w-3.5" aria-hidden="true" />
            {etiqueta}
          </button>
        );
      })}
    </div>
  );
}
