"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Filter, X } from "lucide-react";
import { ESTADO_FORMACION_LABEL, ORDEN_EMBUDO } from "@/lib/formacion";

/**
 * Filtros del panel. Escriben en la URL, no en estado local: así el panel
 * filtrado se comparte por enlace, sobrevive a un F5 y el botón "atrás"
 * deshace el filtro. Los widgets son Server Components que releen los
 * searchParams, de modo que cambiar un filtro los recalcula todos a la vez y
 * nunca quedan dos widgets mirando universos distintos.
 */
export function FiltrosGlobales({
  municipios,
  cursos,
}: {
  municipios: { id: string; nombre: string }[];
  cursos: { id: string; title: string }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pendiente, startTransition] = useTransition();

  function fijar(clave: string, valor: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (valor) params.set(clave, valor);
    else params.delete(clave);
    // Cambiar un filtro invalida la página en la que estabas: la fila 13 del
    // universo anterior no es la fila 13 del nuevo.
    params.delete("pagina");
    params.delete("persona");
    startTransition(() => router.push(`/admin?${params.toString()}`, { scroll: false }));
  }

  const activos = ["municipio", "personal", "curso", "estado"].filter((k) => searchParams.get(k));

  const selectClass =
    "h-9 min-w-0 rounded-lg border border-input bg-card px-2.5 text-sm text-foreground outline-none transition-colors focus:ring-2 focus:ring-[var(--accent)] disabled:opacity-60";

  return (
    <div
      className="surface flex flex-wrap items-center gap-2 p-3"
      data-pendiente={pendiente}
      aria-busy={pendiente}
    >
      <span className="flex items-center gap-1.5 pr-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        <Filter className="h-3.5 w-3.5" />
        Filtros
      </span>

      <select
        aria-label="Municipio"
        className={selectClass}
        disabled={pendiente}
        value={searchParams.get("municipio") ?? ""}
        onChange={(e) => fijar("municipio", e.target.value)}
      >
        <option value="">Todos los municipios</option>
        {municipios.map((m) => (
          <option key={m.id} value={m.id}>
            {m.nombre}
          </option>
        ))}
      </select>

      <select
        aria-label="Tipo de personal"
        className={selectClass}
        disabled={pendiente}
        value={searchParams.get("personal") ?? ""}
        onChange={(e) => fijar("personal", e.target.value)}
      >
        <option value="">Todo el personal</option>
        <option value="ASISTENCIAL">Asistencial</option>
        <option value="ADMINISTRATIVO">Administrativo</option>
      </select>

      <select
        aria-label="Curso"
        className={selectClass}
        disabled={pendiente}
        value={searchParams.get("curso") ?? ""}
        onChange={(e) => fijar("curso", e.target.value)}
      >
        <option value="">Todos los cursos</option>
        {cursos.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title}
          </option>
        ))}
      </select>

      <select
        aria-label="Estado de formación"
        className={selectClass}
        disabled={pendiente}
        value={searchParams.get("estado") ?? ""}
        onChange={(e) => fijar("estado", e.target.value)}
      >
        <option value="">Cualquier estado</option>
        {ORDEN_EMBUDO.map((e) => (
          <option key={e} value={e}>
            {ESTADO_FORMACION_LABEL[e]}
          </option>
        ))}
      </select>

      {activos.length > 0 && (
        <button
          type="button"
          onClick={() => startTransition(() => router.push("/admin", { scroll: false }))}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
          Quitar {activos.length} {activos.length === 1 ? "filtro" : "filtros"}
        </button>
      )}
    </div>
  );
}
