"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Grid2x2, LineChart, Map, BookOpen, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const VISTAS: { clave: string; etiqueta: string; icono: LucideIcon }[] = [
  { clave: "resumen", etiqueta: "Resumen", icono: Grid2x2 },
  { clave: "tendencias", etiqueta: "Tendencias", icono: LineChart },
  { clave: "territorio", etiqueta: "Territorio", icono: Map },
  { clave: "cursos", etiqueta: "Cursos", icono: BookOpen },
];

/**
 * Modalidades de vista del centro de datos. Todas las secciones llegan ya
 * renderizadas del servidor (una sola carga de datos); aquí solo se decide
 * cuál se ve. La vista viaja en la URL para sobrevivir a la paginación del
 * detalle y poder compartirse por enlace.
 */
export function CentroVistas({
  resumen,
  tendencias,
  territorio,
  cursos,
}: {
  resumen: React.ReactNode;
  tendencias: React.ReactNode;
  territorio: React.ReactNode;
  cursos: React.ReactNode;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [vista, setVista] = useState(() => {
    const v = params.get("vista");
    return VISTAS.some((x) => x.clave === v) ? (v as string) : "resumen";
  });

  function cambiar(clave: string) {
    setVista(clave);
    const siguientes = new URLSearchParams(params.toString());
    siguientes.set("vista", clave);
    router.replace(`?${siguientes.toString()}`, { scroll: false });
  }

  const secciones: Record<string, React.ReactNode> = { resumen, tendencias, territorio, cursos };

  return (
    <div className="space-y-5">
      <div
        role="tablist"
        aria-label="Vistas del centro de datos"
        className="surface-lumen inline-flex max-w-full items-center gap-1 overflow-x-auto p-1.5"
      >
        {VISTAS.map((v) => {
          const activa = vista === v.clave;
          return (
            <button
              key={v.clave}
              type="button"
              role="tab"
              aria-selected={activa}
              onClick={() => cambiar(v.clave)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-[13px] font-semibold transition-all duration-200",
                activa
                  ? "bg-gradient-to-r from-[var(--accent)] to-[color-mix(in_oklch,var(--accent)_65%,var(--primary))] text-white shadow-md shadow-[color-mix(in_oklch,var(--accent)_35%,transparent)]"
                  : "text-muted-foreground hover:bg-card/70 hover:text-foreground"
              )}
            >
              <v.icono className="h-4 w-4" aria-hidden="true" />
              {v.etiqueta}
            </button>
          );
        })}
      </div>

      {/* Todas montadas, solo una visible: cambiar de vista es instantáneo y
          la tabla del detalle conserva su paginación del servidor. */}
      {VISTAS.map((v) => (
        <section key={v.clave} role="tabpanel" hidden={vista !== v.clave} className="space-y-5">
          {secciones[v.clave]}
        </section>
      ))}
    </div>
  );
}
