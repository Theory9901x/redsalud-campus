"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, RotateCcw, Search } from "lucide-react";
import { ETIQUETA_ESTADO, ETIQUETA_AUDIENCIA } from "@/components/encuestas/tarjeta-encuesta";

/**
 * Filtros del espacio de trabajo, con su etiqueta encima de cada campo.
 *
 * Se aplican solos -sin botón "Filtrar"- y viven en la URL, para que un
 * filtro concreto se pueda compartir por enlace. La búsqueda espera a que se
 * deje de teclear antes de navegar, para no lanzar una consulta por tecla.
 */
export function FiltrosEncuestasBarra({
  areas = [],
  actividades = [],
}: {
  areas?: { id: string; nombre: string }[];
  actividades?: { id: string; titulo: string }[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [texto, setTexto] = useState(params.get("q") ?? "");
  const [pendiente, startTransition] = useTransition();
  const montado = useRef(false);
  // Al limpiar, los selects (no controlados) se vuelven a montar en blanco.
  const [reinicio, setReinicio] = useState(0);
  const inicial = (clave: string) => (reinicio ? "" : (params.get(clave) ?? ""));

  function navegar(cambios: Record<string, string | null>) {
    const siguientes = new URLSearchParams(params.toString());
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor) siguientes.set(clave, valor);
      else siguientes.delete(clave);
    }
    startTransition(() => router.replace(`/encuestas?${siguientes.toString()}`, { scroll: false }));
  }

  useEffect(() => {
    if (!montado.current) {
      montado.current = true;
      return;
    }
    const t = setTimeout(() => navegar({ q: texto.trim() || null }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto]);

  const hayFiltros = ["q", "area", "capacitacion", "estado", "audiencia"].some((k) => params.get(k));

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="enc-campo min-w-[min(100%,240px)] flex-[2_1_240px]">
        <span>Buscar</span>
        <span className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Título o código…"
            aria-label="Buscar encuestas"
            className="enc-control enc-con-icono"
          />
          {pendiente && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden="true" />
          )}
        </span>
      </label>

      {areas.length > 0 && (
        <label className="enc-campo flex-[1_1_160px]">
          <span>Área</span>
          <select
            key={`area-${reinicio}`}
            defaultValue={inicial("area")}
            onChange={(e) => navegar({ area: e.target.value || null })}
            className="enc-control"
          >
            <option value="">Todas las áreas</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>
        </label>
      )}

      {actividades.length > 0 && (
        <label className="enc-campo flex-[1_1_180px]">
          <span>Capacitación</span>
          <select
            key={`capacitacion-${reinicio}`}
            defaultValue={inicial("capacitacion")}
            onChange={(e) => navegar({ capacitacion: e.target.value || null })}
            className="enc-control"
          >
            <option value="">Toda capacitación</option>
            {actividades.map((a) => (
              <option key={a.id} value={a.id}>
                {a.titulo}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="enc-campo flex-[1_1_140px]">
        <span>Estado</span>
        <select
          key={`estado-${reinicio}`}
          defaultValue={inicial("estado")}
          onChange={(e) => navegar({ estado: e.target.value || null })}
          className="enc-control"
        >
          <option value="">Todos los estados</option>
          {Object.entries(ETIQUETA_ESTADO).map(([valor, etiqueta]) => (
            <option key={valor} value={valor}>
              {etiqueta}
            </option>
          ))}
        </select>
      </label>

      <label className="enc-campo flex-[1_1_150px]">
        <span>Audiencia</span>
        <select
          key={`audiencia-${reinicio}`}
          defaultValue={inicial("audiencia")}
          onChange={(e) => navegar({ audiencia: e.target.value || null })}
          className="enc-control"
        >
          <option value="">Toda audiencia</option>
          {Object.entries(ETIQUETA_AUDIENCIA).map(([valor, etiqueta]) => (
            <option key={valor} value={valor}>
              {etiqueta}
            </option>
          ))}
        </select>
      </label>

      {hayFiltros && (
        <button
          type="button"
          onClick={() => {
            setTexto("");
            setReinicio((n) => n + 1);
            const vista = params.get("vista");
            startTransition(() => router.replace(vista ? `/encuestas?vista=${vista}` : "/encuestas", { scroll: false }));
          }}
          className="enc-boton"
          title="Quitar todos los filtros"
        >
          <RotateCcw aria-hidden="true" />
          Limpiar
        </button>
      )}
    </div>
  );
}
