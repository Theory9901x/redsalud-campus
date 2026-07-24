"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Compass, Loader2, Search, User } from "lucide-react";
import { buscarGlobal, type ResultadoBusqueda } from "@/app/buscar/actions";
import { cn } from "@/lib/utils";

const ICONO = {
  Cursos: BookOpen,
  Personas: User,
  Secciones: Compass,
} as const;

/**
 * Buscador global con paleta de comandos (Ctrl/⌘ + K).
 *
 * Qué devuelve cada rol lo decide el servidor (ver app/buscar/actions.ts);
 * aquí solo se pinta lo que llegue.
 */
export function BuscadorGlobal() {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState<ResultadoBusqueda[]>([]);
  const [cargando, setCargando] = useState(false);
  const [indice, setIndice] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  // Cada búsqueda lleva un número; solo la última puede escribir el resultado.
  // Sin esto, una respuesta lenta de "ma" puede llegar después de "marta" y
  // pisar los resultados buenos con los viejos.
  const peticion = useRef(0);

  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAbierto((v) => !v);
      }
      if (e.key === "Escape") setAbierto(false);
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, []);

  useEffect(() => {
    if (abierto) inputRef.current?.focus();
    else {
      setTexto("");
      setResultados([]);
      setIndice(0);
    }
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;
    const id = window.setTimeout(async () => {
      const mio = ++peticion.current;
      setCargando(true);
      try {
        const r = await buscarGlobal(texto);
        if (mio === peticion.current) {
          setResultados(r);
          setIndice(0);
        }
      } finally {
        if (mio === peticion.current) setCargando(false);
      }
    }, 200);
    return () => window.clearTimeout(id);
  }, [texto, abierto]);

  const ir = useCallback(
    (r: ResultadoBusqueda) => {
      setAbierto(false);
      router.push(r.href);
    },
    [router]
  );

  const navegar = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndice((i) => Math.min(i + 1, resultados.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndice((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && resultados[indice]) {
      e.preventDefault();
      ir(resultados[indice]);
    }
  };

  // Los resultados llegan ya ordenados por grupo; aquí solo se detecta dónde
  // empieza cada uno para pintar su encabezado.
  let grupoAnterior: string | null = null;

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="hidden h-10 w-64 items-center gap-2 rounded-xl border border-border bg-card/60 px-3 text-sm text-muted-foreground transition-colors hover:border-[var(--accent)]/40 hover:text-foreground md:flex"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">Buscar...</span>
        <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold">
          Ctrl K
        </kbd>
      </button>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label="Buscar"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground md:hidden"
      >
        <Search className="h-5 w-5" />
      </button>

      {abierto && (
        <div
          className="fixed inset-0 z-[60] flex items-start justify-center bg-navy/50 p-4 pt-[12vh] backdrop-blur-sm"
          onClick={() => setAbierto(false)}
          role="presentation"
        >
          <div
            className="surface-panel w-full max-w-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Buscador global"
          >
            <div className="flex items-center gap-2.5 border-b border-border px-4">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={navegar}
                placeholder="Busca un curso, una persona o una sección..."
                className="h-14 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              {cargando && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
            </div>

            <div className="max-h-[55vh] overflow-y-auto p-2">
              {resultados.length === 0 && !cargando && (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                  {texto.trim().length >= 2
                    ? `No se encontró nada para "${texto.trim()}".`
                    : "Escribe al menos dos letras para buscar."}
                </p>
              )}

              {resultados.map((r, i) => {
                const Icono = ICONO[r.grupo];
                const encabezado = r.grupo !== grupoAnterior ? r.grupo : null;
                grupoAnterior = r.grupo;
                return (
                  <div key={r.id}>
                    {encabezado && (
                      <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {encabezado}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => ir(r)}
                      onMouseEnter={() => setIndice(i)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                        i === indice ? "bg-[var(--accent)]/12 text-foreground" : "text-muted-foreground"
                      )}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)]/12 text-[var(--accent)]">
                        <Icono className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">{r.titulo}</span>
                        <span className="block truncate text-xs text-muted-foreground">{r.detalle}</span>
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-4 border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
              <span>↑↓ moverse</span>
              <span>↵ abrir</span>
              <span>Esc cerrar</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
