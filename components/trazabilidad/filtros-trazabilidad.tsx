"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

export type OpcionArea = { id: string; nombre: string };
export type OpcionCapacitacion = { id: string; titulo: string; areaId: string };

/**
 * Filtros del detalle nominal: área, capacitación y nombre. Viven en la URL
 * (?area=&actividad=&q=) para que un enlace se pueda compartir tal cual; el
 * trimestre (?t=) lo cambia el selector de arriba y se conserva aquí.
 */
export function FiltrosTrazabilidad({
  areas,
  capacitaciones,
  area,
  actividad,
  q,
}: {
  areas: OpcionArea[];
  capacitaciones: OpcionCapacitacion[];
  area: string;
  actividad: string;
  q: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pendiente, startTransition] = useTransition();
  const [texto, setTexto] = useState(q);
  const primera = useRef(true);

  const navegar = (cambios: Record<string, string>) => {
    const siguiente = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(cambios)) {
      if (v) siguiente.set(k, v);
      else siguiente.delete(k);
    }
    siguiente.delete("page");
    const cadena = siguiente.toString();
    startTransition(() => router.replace(`${pathname}${cadena ? `?${cadena}` : ""}#personas`, { scroll: false }));
  };

  // Búsqueda con pausa: escribe, y a los 350 ms la URL se actualiza sola.
  useEffect(() => {
    if (primera.current) {
      primera.current = false;
      return;
    }
    if (texto.trim() === q) return;
    const id = setTimeout(() => navegar({ q: texto.trim() }), 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto]);

  const visibles = area ? capacitaciones.filter((c) => c.areaId === area) : capacitaciones;
  const hayFiltro = Boolean(area || actividad || q);

  return (
    <div className="traz-filtros form-premium" data-pendiente={pendiente || undefined}>
      <label className="traz-filtro traz-filtro-busqueda">
        <span className="mono-label">Persona</span>
        <span className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar por nombre…"
            aria-label="Buscar persona por nombre"
            className="w-full"
          />
        </span>
      </label>
      <label className="traz-filtro">
        <span className="mono-label">Área</span>
        <select
          value={area}
          onChange={(e) => navegar({ area: e.target.value, actividad: "" })}
          aria-label="Filtrar por área"
        >
          <option value="">Todas las áreas</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nombre}
            </option>
          ))}
        </select>
      </label>
      <label className="traz-filtro">
        <span className="mono-label">Capacitación</span>
        <select
          value={actividad}
          onChange={(e) => navegar({ actividad: e.target.value })}
          aria-label="Filtrar por capacitación"
        >
          <option value="">Todas las capacitaciones</option>
          {visibles.map((c) => (
            <option key={c.id} value={c.id}>
              {c.titulo}
            </option>
          ))}
        </select>
      </label>
      {hayFiltro && (
        <button
          type="button"
          className="traz-limpiar"
          onClick={() => {
            setTexto("");
            navegar({ area: "", actividad: "", q: "" });
          }}
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          Limpiar
        </button>
      )}
    </div>
  );
}
