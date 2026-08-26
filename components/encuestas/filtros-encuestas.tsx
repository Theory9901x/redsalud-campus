"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { ETIQUETA_ESTADO, ETIQUETA_AUDIENCIA } from "@/components/encuestas/tarjeta-encuesta";

const selectClase =
  "h-10 rounded-xl border border-border/60 bg-card/70 px-3 text-[13px] text-foreground outline-none backdrop-blur-sm transition-colors focus:border-primary/50";

/**
 * Filtros del espacio de trabajo, en UNA fila.
 *
 * Se aplican solos -sin botón "Filtrar"- y viven en la URL, para que un
 * filtro concreto se pueda compartir por enlace. La búsqueda espera a que se
 * deje de teclear antes de navegar, para no lanzar una consulta por tecla.
 */
export function FiltrosEncuestasBarra() {
  const router = useRouter();
  const params = useSearchParams();
  const [texto, setTexto] = useState(params.get("q") ?? "");
  const [pendiente, startTransition] = useTransition();
  const montado = useRef(false);

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

  return (
    <div className="surface-lumen mt-5 flex flex-wrap items-center gap-3 p-4">
      <div className="relative min-w-[220px] flex-1">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar por título o código…"
          aria-label="Buscar encuestas"
          className="h-10 w-full rounded-xl border border-border/60 bg-card/70 pl-10 pr-9 text-[13px] outline-none backdrop-blur-sm transition-colors focus:border-primary/50"
        />
        {pendiente && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      <select
        aria-label="Estado"
        defaultValue={params.get("estado") ?? ""}
        onChange={(e) => navegar({ estado: e.target.value || null })}
        className={selectClase}
      >
        <option value="">Todos los estados</option>
        {Object.entries(ETIQUETA_ESTADO).map(([valor, etiqueta]) => (
          <option key={valor} value={valor}>
            {etiqueta}
          </option>
        ))}
      </select>

      <select
        aria-label="Audiencia"
        defaultValue={params.get("audiencia") ?? ""}
        onChange={(e) => navegar({ audiencia: e.target.value || null })}
        className={selectClase}
      >
        <option value="">Toda audiencia</option>
        {Object.entries(ETIQUETA_AUDIENCIA).map(([valor, etiqueta]) => (
          <option key={valor} value={valor}>
            {etiqueta}
          </option>
        ))}
      </select>
    </div>
  );
}
