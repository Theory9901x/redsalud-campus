"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Play, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type VideoTeca = { id: string; titulo: string; grupo: string; seg: number };

function duracion(seg: number) {
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `0:${String(s).padStart(2, "0")}`;
}

/**
 * VIDEOTECA: muchos videos en UNA sola lección, sin 44 sub-lecciones.
 *
 * Un único reproductor arriba y la lista vertical de títulos agrupada por
 * tema debajo: el iframe de YouTube se monta solo para el video elegido
 * -44 iframes a la vez congelarían la página-. Lo visto se recuerda en el
 * navegador de cada persona (es una guía de repaso, no una calificación:
 * la lección se completa con su botón normal).
 */
export function Videoteca({ leccionId, videos }: { leccionId: string; videos: VideoTeca[] }) {
  const clave = `videoteca-${leccionId}`;
  const [actual, setActual] = useState(videos[0]?.id ?? "");
  const [reproduciendo, setReproduciendo] = useState(false);
  const [vistos, setVistos] = useState<Set<string>>(new Set());
  const [busqueda, setBusqueda] = useState("");
  const playerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const guardado = JSON.parse(localStorage.getItem(clave) ?? "[]");
      if (Array.isArray(guardado)) setVistos(new Set(guardado.filter((x) => typeof x === "string")));
    } catch {
      // Sin almacenamiento: la guía de vistos vive solo esta sesión.
    }
  }, [clave]);

  function elegir(id: string) {
    setActual(id);
    setReproduciendo(true);
    setVistos((prev) => {
      const siguiente = new Set(prev).add(id);
      try {
        localStorage.setItem(clave, JSON.stringify([...siguiente]));
      } catch {
        // idem
      }
      return siguiente;
    });
    playerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  const termino = busqueda.trim().toLowerCase();
  const filtrados = useMemo(
    () => (termino ? videos.filter((v) => v.titulo.toLowerCase().includes(termino) || v.grupo.toLowerCase().includes(termino)) : videos),
    [videos, termino]
  );
  const grupos = useMemo(() => {
    const mapa = new Map<string, VideoTeca[]>();
    for (const v of filtrados) {
      const lista = mapa.get(v.grupo) ?? [];
      lista.push(v);
      mapa.set(v.grupo, lista);
    }
    return [...mapa.entries()];
  }, [filtrados]);

  const activo = videos.find((v) => v.id === actual) ?? videos[0];
  const totalMin = Math.round(videos.reduce((s, v) => s + v.seg, 0) / 60);

  return (
    <div className="space-y-4">
      {/* ---- Reproductor único ---- */}
      <div ref={playerRef} className="scroll-mt-24">
        <div className="player-shell">
          {reproduciendo ? (
            <iframe
              key={activo.id}
              src={`https://www.youtube.com/embed/${activo.id}?autoplay=1`}
              title={activo.titulo}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            /* Fachada: ni un solo iframe hasta que la persona da play. */
            <button
              type="button"
              onClick={() => elegir(activo.id)}
              className="group relative block w-full overflow-hidden rounded-[14px] bg-black"
              style={{ aspectRatio: "16 / 9" }}
              aria-label={`Reproducir: ${activo.titulo}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- miniatura externa de YouTube */}
              <img
                src={`https://i.ytimg.com/vi/${activo.id}/hqdefault.jpg`}
                alt=""
                className="h-full w-full object-cover opacity-80 transition-transform duration-300 group-hover:scale-[1.02]"
              />
              <span className="absolute inset-0 grid place-items-center">
                <span className="grid h-16 w-16 place-items-center rounded-full bg-[var(--accent)] text-white shadow-xl transition-transform group-hover:scale-110">
                  <Play className="ml-1 h-7 w-7 fill-current" aria-hidden="true" />
                </span>
              </span>
            </button>
          )}
        </div>
        <p className="mt-2 text-center text-[13.5px] font-semibold text-foreground">
          {activo.titulo}
          <span className="ml-2 text-[12px] font-normal text-muted-foreground">
            {activo.grupo} · {duracion(activo.seg)}
          </span>
        </p>
      </div>

      {/* ---- Barra: progreso de repaso + buscador ---- */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-[200px]">
          <p className="text-[12px] font-semibold text-foreground">
            {vistos.size} de {videos.length} videos vistos
            <span className="ml-1.5 font-normal text-muted-foreground">· {totalMin} min en total</span>
          </p>
          <div className="mt-1 h-1.5 w-48 overflow-hidden rounded-full bg-[color-mix(in_oklch,var(--muted-foreground)_16%,transparent)]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--primary)] transition-[width] duration-300"
              style={{ width: `${Math.round((vistos.size / Math.max(videos.length, 1)) * 100)}%` }}
            />
          </div>
        </div>
        <label className="flex h-9 min-w-[220px] items-center gap-2 rounded-xl border border-border/60 bg-background/70 px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar en la videoteca…"
            aria-label="Buscar video"
            className="w-full bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
          />
        </label>
      </div>

      {/* ---- Lista vertical agrupada ---- */}
      {grupos.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Nada coincide con «{busqueda}».</p>
      ) : (
        grupos.map(([grupo, lista]) => (
          <section key={grupo}>
            <h3 className="mb-2 flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" aria-hidden="true" />
              {grupo}
              <span className="font-semibold normal-case tracking-normal">· {lista.length}</span>
            </h3>
            <ul className="space-y-1.5">
              {lista.map((v) => {
                const esActual = v.id === actual && reproduciendo;
                const visto = vistos.has(v.id);
                return (
                  <li key={v.id}>
                    <button
                      type="button"
                      onClick={() => elegir(v.id)}
                      aria-current={esActual ? "true" : undefined}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-all duration-200",
                        esActual
                          ? "border-[color-mix(in_oklch,var(--accent)_40%,transparent)] bg-[color-mix(in_oklch,var(--accent)_10%,var(--card))] shadow-sm"
                          : "border-border/50 bg-card/50 hover:translate-x-0.5 hover:border-[color-mix(in_oklch,var(--accent)_35%,transparent)] hover:bg-card"
                      )}
                    >
                      <span className="relative h-12 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                        {/* eslint-disable-next-line @next/next/no-img-element -- miniatura externa de YouTube */}
                        <img
                          src={`https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                        <span className="absolute bottom-0.5 right-0.5 rounded bg-black/75 px-1 text-[10px] font-semibold tabular-nums text-white">
                          {duracion(v.seg)}
                        </span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn("block truncate text-[13.5px]", esActual ? "font-bold text-foreground" : "font-medium text-foreground/90")}>
                          {v.titulo}
                        </span>
                        <span className="block text-[11px] text-muted-foreground">
                          {esActual ? "Reproduciendo ahora" : visto ? "Visto" : "Sin ver"}
                        </span>
                      </span>
                      {esActual ? (
                        <Play className="h-4 w-4 shrink-0 fill-current text-[var(--accent)]" aria-hidden="true" />
                      ) : visto ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
