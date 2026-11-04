"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Link2, Loader2, Maximize } from "lucide-react";
import { duracionTexto } from "@/lib/videoteca/formato";

const VELOCIDADES = [1, 1.25, 1.5, 2];

/**
 * Reproductor de la Videoteca: el <video> nativo (en el celular abre su
 * pantalla completa, gestos y controles propios), más velocidad, retomar
 * donde quedó y el registro del avance cada pocos segundos.
 */
export function Reproductor({ id, src, tipo, portada, posicion, duracion }: { id: string; src: string; tipo: string; portada: string | null; posicion: number; duracion: number | null }) {
  const ref = useRef<HTMLVideoElement>(null);
  const ultimo = useRef(-1);
  const [velocidad, setVelocidad] = useState(1);
  const [retomar, setRetomar] = useState(posicion > 10 && (!duracion || posicion < duracion * 0.95));
  const [copiado, setCopiado] = useState(false);
  const [cargando, setCargando] = useState(true);

  const enviar = useCallback(
    (forzar = false) => {
      const v = ref.current;
      if (!v || !Number.isFinite(v.currentTime)) return;
      const t = Math.floor(v.currentTime);
      if (!forzar && Math.abs(t - ultimo.current) < 10) return;
      ultimo.current = t;
      void fetch(`/api/videos/${id}/progreso`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({ posicion: t, duracion: Math.floor(v.duration || 0) }),
      }).catch(() => {});
    },
    [id],
  );

  useEffect(() => {
    const alSalir = () => enviar(true);
    window.addEventListener("pagehide", alSalir);
    return () => {
      window.removeEventListener("pagehide", alSalir);
      enviar(true);
    };
  }, [enviar]);

  // Pantalla completa del propio video (en iPhone, la nativa de Safari).
  const ampliar = () => {
    const v = ref.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (!v) return;
    if (document.fullscreenElement) return void document.exitFullscreen().catch(() => {});
    if (v.requestFullscreen) void v.requestFullscreen().catch(() => v.webkitEnterFullscreen?.());
    else v.webkitEnterFullscreen?.();
  };

  const cambiarVelocidad = (x: number) => {
    setVelocidad(x);
    if (ref.current) ref.current.playbackRate = x;
  };

  return (
    <>
      <div className="vt-marco">
        <video
          ref={ref}
          controls
          playsInline
          preload="metadata"
          poster={portada ?? undefined}
          controlsList="nodownload"
          onContextMenu={(e) => e.preventDefault()}
          onLoadedMetadata={() => setCargando(false)}
          onTimeUpdate={() => enviar()}
          onPause={() => enviar(true)}
          onEnded={() => enviar(true)}
          onPlay={() => setRetomar(false)}
          onRateChange={(e) => setVelocidad(e.currentTarget.playbackRate)}
        >
          <source src={src} type={tipo === "video/quicktime" ? "video/mp4" : tipo} />
          Tu navegador no puede reproducir este video.
        </video>
        {cargando && (
          <span className="pointer-events-none absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-[12px] font-semibold text-white">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            Cargando…
          </span>
        )}
        {retomar && (
          <div className="vt-retomar" role="group" aria-label="Retomar">
            <span>Ibas en {duracionTexto(posicion)}</span>
            <button
              type="button"
              className="si"
              onClick={() => {
                const v = ref.current;
                if (!v) return;
                v.currentTime = posicion;
                void v.play().catch(() => {});
                setRetomar(false);
              }}
            >
              Continuar
            </button>
            <button
              type="button"
              className="no"
              onClick={() => {
                const v = ref.current;
                if (!v) return;
                v.currentTime = 0;
                void v.play().catch(() => {});
                setRetomar(false);
              }}
            >
              Desde el inicio
            </button>
          </div>
        )}
      </div>

      <div className="vt-controles">
        <button type="button" className="vt-grande" onClick={ampliar}>
          <Maximize className="h-4 w-4" aria-hidden="true" />
          Ver en pantalla completa
        </button>
        <div className="vt-vel" role="group" aria-label="Velocidad">
          {VELOCIDADES.map((x) => (
            <button key={x} type="button" aria-pressed={velocidad === x} onClick={() => cambiarVelocidad(x)}>
              {x}×
            </button>
          ))}
        </div>
        <button
          type="button"
          className="vt-chip"
          onClick={async () => {
            const url = window.location.href;
            try {
              if (navigator.share && window.matchMedia("(pointer: coarse)").matches) await navigator.share({ title: document.title, url });
              else await navigator.clipboard.writeText(url);
              setCopiado(true);
              setTimeout(() => setCopiado(false), 2000);
            } catch {}
          }}
        >
          {copiado ? <Check className="h-4 w-4" aria-hidden="true" /> : <Link2 className="h-4 w-4" aria-hidden="true" />}
          {copiado ? "Enlace copiado" : "Compartir enlace"}
        </button>
      </div>
    </>
  );
}
