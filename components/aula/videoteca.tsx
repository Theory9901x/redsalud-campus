"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpenCheck,
  Boxes,
  CheckCircle2,
  FileSignature,
  Landmark,
  LayoutGrid,
  Play,
  RefreshCcw,
  Search,
  Stethoscope,
  Syringe,
  Smile,
  FlaskConical,
  HeartPulse,
  Film,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** `archivo` (URL /api/media/...) reemplaza a YouTube para videos propios. */
export type VideoTeca = { id: string; titulo: string; grupo: string; seg: number; archivo?: string };

function duracion(seg: number) {
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const ICONO_GRUPO: Record<string, LucideIcon> = {
  "Contratación": FileSignature,
  "Presupuesto": Wallet,
  "Contabilidad": BookOpenCheck,
  "Tesorería": Landmark,
  "Nómina": Users,
  "Almacén y activos": Boxes,
  "Urgencias y hospitalización": HeartPulse,
  "Consulta externa": Stethoscope,
  "Odontología": Smile,
  "Promoción y mantenimiento (Res. 3280)": Syringe,
  "Laboratorio clínico": FlaskConical,
};

const TODAS = "__todas__";

/**
 * VIDEOTECA: muchos videos en UNA sola lección.
 *
 * Al entrar, la persona ELIGE SU ÁREA (los videos ya vienen categorizados)
 * y solo se despliegan los de esa categoría: quien es de tesorería no tiene
 * por qué navegar los de nómina. La elección se recuerda en su navegador y
 * se puede cambiar en cualquier momento; también existe "ver todo".
 *
 * Un único reproductor (fachada: cero iframes hasta dar play) y la lista
 * vertical de títulos del área elegida. Lo visto se recuerda localmente:
 * es guía de repaso, no calificación.
 */
export function Videoteca({ leccionId, videos }: { leccionId: string; videos: VideoTeca[] }) {
  const claveVistos = `videoteca-${leccionId}`;
  const claveArea = `videoteca-area-${leccionId}`;

  const [area, setArea] = useState<string | null>(null);
  const [cargado, setCargado] = useState(false);
  const [actual, setActual] = useState(videos[0]?.id ?? "");
  const [reproduciendo, setReproduciendo] = useState(false);
  const [vistos, setVistos] = useState<Set<string>>(new Set());
  const [busqueda, setBusqueda] = useState("");
  const playerRef = useRef<HTMLDivElement>(null);

  const grupos = useMemo(() => {
    const mapa = new Map<string, VideoTeca[]>();
    for (const v of videos) {
      const lista = mapa.get(v.grupo) ?? [];
      lista.push(v);
      mapa.set(v.grupo, lista);
    }
    return [...mapa.entries()];
  }, [videos]);

  useEffect(() => {
    try {
      const guardado = JSON.parse(localStorage.getItem(claveVistos) ?? "[]");
      if (Array.isArray(guardado)) setVistos(new Set(guardado.filter((x) => typeof x === "string")));
      const areaGuardada = localStorage.getItem(claveArea);
      if (areaGuardada && (areaGuardada === TODAS || grupos.some(([g]) => g === areaGuardada))) {
        setArea(areaGuardada);
      }
    } catch {
      // Sin almacenamiento: se pregunta el área cada vez.
    }
    setCargado(true);
  }, [claveVistos, claveArea, grupos]);

  function elegirArea(a: string) {
    setArea(a);
    setBusqueda("");
    try {
      localStorage.setItem(claveArea, a);
    } catch {
      // idem
    }
    const primera = a === TODAS ? videos[0] : videos.find((v) => v.grupo === a);
    if (primera) {
      setActual(primera.id);
      setReproduciendo(false);
    }
  }

  function elegir(id: string) {
    setActual(id);
    setReproduciendo(true);
    setVistos((prev) => {
      const siguiente = new Set(prev).add(id);
      try {
        localStorage.setItem(claveVistos, JSON.stringify([...siguiente]));
      } catch {
        // idem
      }
      return siguiente;
    });
    playerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  // Hasta leer el almacenamiento no se decide qué pintar (evita el parpadeo
  // selector→lista en quien ya eligió).
  if (!cargado) {
    return <div className="h-64 animate-pulse rounded-2xl bg-foreground/[0.05]" aria-busy="true" />;
  }

  /* ---------------- Selector de área ---------------- */
  if (!area) {
    return (
      <div>
        <div className="mb-4 text-center">
          <h2 className="font-display text-[19px] font-extrabold tracking-tight text-foreground">
            ¿A qué área perteneces?
          </h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Se desplegarán solo los videotutoriales de tu área. Puedes cambiarla cuando quieras.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {grupos.map(([g, lista], i) => {
            const Icono = ICONO_GRUPO[g] ?? LayoutGrid;
            const min = Math.round(lista.reduce((s, v) => s + v.seg, 0) / 60);
            const vistosGrupo = lista.filter((v) => vistos.has(v.id)).length;
            const pct = Math.round((vistosGrupo / lista.length) * 100);
            return (
              <button
                key={g}
                type="button"
                onClick={() => elegirArea(g)}
                style={{ animationDelay: `${i * 60}ms` }}
                className="tarjeta-area group"
              >
                <span className="tarjeta-area-halo" aria-hidden="true" />
                <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[color-mix(in_oklch,var(--accent)_22%,transparent)] to-[color-mix(in_oklch,var(--primary)_14%,transparent)] text-[var(--accent)] ring-1 ring-[color-mix(in_oklch,var(--accent)_25%,transparent)] transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[-4deg]">
                  <Icono className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="relative min-w-0 flex-1">
                  <span className="block text-[14px] font-bold leading-snug text-foreground">{g}</span>
                  <span className="mt-0.5 block text-[11.5px] text-muted-foreground">
                    {lista.length} {lista.length === 1 ? "video" : "videos"} · {min} min
                    {vistosGrupo > 0 && <span className="ml-1 font-semibold text-success">· {pct}% visto</span>}
                  </span>
                  <span className="mt-2 block h-1 w-full overflow-hidden rounded-full bg-[color-mix(in_oklch,var(--muted-foreground)_14%,transparent)]">
                    <span
                      className="block h-full rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--primary)] transition-[width] duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </span>
                </span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => elegirArea(TODAS)}
            style={{ animationDelay: `${grupos.length * 60}ms` }}
            className="tarjeta-area group !border-dashed"
          >
            <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-muted/70 text-muted-foreground transition-transform duration-300 group-hover:scale-110">
              <LayoutGrid className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="relative min-w-0">
              <span className="block text-[14px] font-bold text-foreground">Ver toda la videoteca</span>
              <span className="block text-[11.5px] text-muted-foreground">
                Los {videos.length} videos, agrupados
              </span>
            </span>
          </button>
        </div>
      </div>
    );
  }

  /* ---------------- Vista del área elegida ---------------- */
  const delArea = area === TODAS ? videos : videos.filter((v) => v.grupo === area);
  const termino = busqueda.trim().toLowerCase();
  const filtrados = termino
    ? delArea.filter((v) => v.titulo.toLowerCase().includes(termino) || v.grupo.toLowerCase().includes(termino))
    : delArea;
  const seccionado = (() => {
    const mapa = new Map<string, VideoTeca[]>();
    for (const v of filtrados) {
      const lista = mapa.get(v.grupo) ?? [];
      lista.push(v);
      mapa.set(v.grupo, lista);
    }
    return [...mapa.entries()];
  })();

  const activo = delArea.find((v) => v.id === actual) ?? delArea[0] ?? videos[0];
  const vistosArea = delArea.filter((v) => vistos.has(v.id)).length;
  const minArea = Math.round(delArea.reduce((s, v) => s + v.seg, 0) / 60);
  const IconoArea = area === TODAS ? LayoutGrid : (ICONO_GRUPO[area] ?? LayoutGrid);

  return (
    <div className="space-y-4">
      {/* ---- Área activa ---- */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 rounded-full border border-[color-mix(in_oklch,var(--accent)_30%,transparent)] bg-[color-mix(in_oklch,var(--accent)_10%,transparent)] px-3.5 py-1.5 text-[12.5px] font-bold text-[var(--accent)]">
          <IconoArea className="h-4 w-4" aria-hidden="true" />
          {area === TODAS ? "Toda la videoteca" : `Área: ${area}`}
          <span className="font-semibold text-muted-foreground">· {delArea.length} videos · {minArea} min</span>
        </span>
        <button
          type="button"
          onClick={() => {
            setArea(null);
            try {
              localStorage.removeItem(claveArea);
            } catch {
              // idem
            }
          }}
          className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-3 py-1.5 text-[12px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <RefreshCcw className="h-3.5 w-3.5" aria-hidden="true" />
          Cambiar de área
        </button>
      </div>

      {/* ---- Reproductor único ---- */}
      <div ref={playerRef} className="scroll-mt-24">
        <div className="player-shell">
          {reproduciendo ? (
            activo.archivo ? (
              <video key={activo.id} src={activo.archivo} controls autoPlay controlsList="nodownload" />
            ) : (
              <iframe
                key={activo.id}
                src={`https://www.youtube.com/embed/${activo.id}?autoplay=1`}
                title={activo.titulo}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            )
          ) : (
            <button
              type="button"
              onClick={() => elegir(activo.id)}
              className="group relative block w-full overflow-hidden rounded-[14px] bg-black"
              style={{ aspectRatio: "16 / 9" }}
              aria-label={`Reproducir: ${activo.titulo}`}
            >
              {activo.archivo ? (
                <span className="grid h-full w-full place-items-center bg-gradient-to-br from-[color-mix(in_oklch,var(--accent)_35%,black)] to-black">
                  <Film className="h-12 w-12 text-white/40" aria-hidden="true" />
                </span>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- miniatura externa de YouTube
                <img
                  src={`https://i.ytimg.com/vi/${activo.id}/hqdefault.jpg`}
                  alt=""
                  className="h-full w-full object-cover opacity-80 transition-transform duration-300 group-hover:scale-[1.02]"
                />
              )}
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

      {/* ---- Progreso del área + buscador ---- */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-[200px]">
          <p className="text-[12px] font-semibold text-foreground">
            {vistosArea} de {delArea.length} videos vistos
          </p>
          <div className="mt-1 h-1.5 w-48 overflow-hidden rounded-full bg-[color-mix(in_oklch,var(--muted-foreground)_16%,transparent)]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--primary)] transition-[width] duration-300"
              style={{ width: `${Math.round((vistosArea / Math.max(delArea.length, 1)) * 100)}%` }}
            />
          </div>
        </div>
        <label className="flex h-9 min-w-[220px] items-center gap-2 rounded-xl border border-border/60 bg-background/70 px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar en el área…"
            aria-label="Buscar video"
            className="w-full bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
          />
        </label>
      </div>

      {/* ---- Lista vertical ---- */}
      {seccionado.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Nada coincide con «{busqueda}».</p>
      ) : (
        seccionado.map(([grupo, lista]) => (
          <section key={grupo}>
            {(area === TODAS || seccionado.length > 1) && (
              <h3 className="mb-2 flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" aria-hidden="true" />
                {grupo}
                <span className="font-semibold normal-case tracking-normal">· {lista.length}</span>
              </h3>
            )}
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
                        {v.archivo ? (
                          <span className="grid h-full w-full place-items-center bg-gradient-to-br from-[color-mix(in_oklch,var(--accent)_30%,black)] to-black">
                            <Film className="h-5 w-5 text-white/50" aria-hidden="true" />
                          </span>
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element -- miniatura externa de YouTube
                          <img
                            src={`https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        )}
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
