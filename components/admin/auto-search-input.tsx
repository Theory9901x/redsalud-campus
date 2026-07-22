"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search } from "lucide-react";

/**
 * Buscador que filtra solo con escribir: no hay botón "Filtrar".
 *
 * Espera a que la persona deje de teclear (debounce) antes de navegar, para
 * no lanzar una consulta por pulsación, y siempre vuelve a la página 1 porque
 * el offset anterior corresponde a otro conjunto de resultados.
 */
export function AutoSearchInput({
  paramName = "q",
  placeholder,
  label,
  delay = 350,
}: {
  paramName?: string;
  placeholder: string;
  label?: string;
  delay?: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [valor, setValor] = useState(searchParams.get(paramName) ?? "");
  const [pendiente, startTransition] = useTransition();
  // Evita navegar en el primer render (el valor ya viene de la URL).
  const montado = useRef(false);

  useEffect(() => {
    if (!montado.current) {
      montado.current = true;
      return;
    }
    const t = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (valor.trim()) params.set(paramName, valor.trim());
      else params.delete(paramName);
      params.set("page", "1");
      startTransition(() => router.replace(`?${params.toString()}`, { scroll: false }));
    }, delay);
    return () => clearTimeout(t);
    // searchParams cambia al navegar; incluirlo reiniciaría el temporizador en bucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor, delay, paramName]);

  return (
    <div className="min-w-[220px] flex-1 space-y-1.5">
      {label && (
        <label htmlFor={paramName} className="text-xs font-medium text-muted-foreground">
          {label}
        </label>
      )}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          id={paramName}
          type="search"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder={placeholder}
          className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-9 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        {pendiente && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>
    </div>
  );
}

/**
 * Select que aplica el filtro al cambiar, sin botón. Mismo criterio de
 * reinicio de página que el buscador.
 */
export function AutoFilterSelect({
  paramName,
  label,
  options,
  allLabel = "Todos",
}: {
  paramName: string;
  label: string;
  options: { value: string; label: string }[];
  allLabel?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  return (
    <div className="space-y-1.5">
      <label htmlFor={paramName} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <select
        id={paramName}
        defaultValue={searchParams.get(paramName) ?? ""}
        onChange={(e) => {
          const params = new URLSearchParams(searchParams.toString());
          if (e.target.value) params.set(paramName, e.target.value);
          else params.delete(paramName);
          params.set("page", "1");
          startTransition(() => router.replace(`?${params.toString()}`, { scroll: false }));
        }}
        className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
