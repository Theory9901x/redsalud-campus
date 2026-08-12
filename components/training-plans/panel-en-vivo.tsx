"use client";

import { useEffect, useRef, useState } from "react";
import { MotionConfig, motion, useReducedMotion } from "framer-motion";
import { Users2, ClipboardCheck, ClipboardList, TrendingUp, RefreshCw } from "lucide-react";
import type { ActivityLiveMetrics } from "@/lib/training-plans";
import { cn } from "@/lib/utils";

const INTERVALO_MS = 12_000;

/**
 * Cifra que "llega nueva": al cambiar de valor cuenta hasta el número en
 * medio segundo, en vez de saltar. Es lo que hace notar al tutor que el dato
 * se actualizó sin que la pantalla parpadee. Con prefers-reduced-motion el
 * número simplemente cambia.
 */
function Cifra({ valor, sufijo = "", reducido }: { valor: number | null; sufijo?: string; reducido: boolean }) {
  const [mostrado, setMostrado] = useState(valor ?? 0);
  const anterior = useRef(valor ?? 0);

  useEffect(() => {
    if (valor === null || reducido) {
      // Quien pide menos movimiento ve el número directo (se rinde abajo sin
      // pasar por el estado), así que aquí no hay nada que animar.
      anterior.current = valor ?? 0;
      return;
    }
    const desde = anterior.current;
    const delta = valor - desde;
    if (delta === 0) return;

    const DURACION = 420;
    const inicio = performance.now();
    let frame = 0;
    const paso = (ahora: number) => {
      const t = Math.min((ahora - inicio) / DURACION, 1);
      // easeOutCubic: arranca rápido y asienta, sin rebote.
      setMostrado(Math.round(desde + delta * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(paso);
      else anterior.current = valor;
    };
    frame = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(frame);
  }, [valor, reducido]);

  if (valor === null) return <span className="cifra-vivo">—</span>;
  return (
    <span className="cifra-vivo tabular-nums">
      {reducido ? valor : mostrado}
      {sufijo}
    </span>
  );
}

type Tarjeta = {
  clave: string;
  etiqueta: string;
  valor: number | null;
  sufijo?: string;
  contexto: string;
  Icono: typeof Users2;
  glow?: "glow-exito" | "glow-alerta" | "glow-critico";
};

/** Semáforo institucional: ≥85 verde, 70-84 ámbar, <70 rojo. */
function semaforo(pct: number | null): Tarjeta["glow"] {
  if (pct === null) return undefined;
  if (pct >= 85) return "glow-exito";
  if (pct >= 70) return "glow-alerta";
  return "glow-critico";
}

export function PanelEnVivo({
  activityId,
  inicial,
  conVideo,
}: {
  activityId: string;
  inicial: ActivityLiveMetrics;
  /** En columna junto a la videollamada las tarjetas se apilan; a ancho completo van en rejilla. */
  conVideo: boolean;
}) {
  const reducido = useReducedMotion() ?? false;
  const [datos, setDatos] = useState(inicial);
  const [refrescando, setRefrescando] = useState(false);

  useEffect(() => {
    let vivo = true;
    const traer = async () => {
      try {
        setRefrescando(true);
        const r = await fetch(`/api/planes-capacitacion/actividades/${activityId}/en-vivo`, { cache: "no-store" });
        if (!r.ok) return;
        const json = (await r.json()) as ActivityLiveMetrics;
        if (vivo) setDatos(json);
      } catch {
        // Un fallo de red no debe vaciar el panel: se conservan las últimas
        // cifras buenas y se reintenta en el siguiente ciclo.
      } finally {
        if (vivo) setRefrescando(false);
      }
    };
    const id = setInterval(traer, INTERVALO_MS);
    return () => {
      vivo = false;
      clearInterval(id);
    };
  }, [activityId]);

  const tarjetas: Tarjeta[] = [
    {
      clave: "asistencia",
      etiqueta: "Asistencia",
      valor: datos.asistentes,
      contexto: `de ${datos.audiencia} convocados · ${datos.porcentajeAsistencia}%`,
      Icono: Users2,
      glow: semaforo(datos.porcentajeAsistencia),
    },
    {
      clave: "presaber",
      etiqueta: "Presaber",
      valor: datos.presaberPresentaron,
      contexto:
        datos.presaberPromedio !== null
          ? `presentaron · promedio ${datos.presaberPromedio}%`
          : "presentaron · sin nota todavía",
      Icono: ClipboardCheck,
    },
    {
      clave: "postsaber",
      etiqueta: "Postsaber",
      valor: datos.postsaberPresentaron,
      contexto:
        datos.postsaberPromedio !== null
          ? `presentaron · promedio ${datos.postsaberPromedio}%`
          : "presentaron · se abre al cerrar el presaber",
      Icono: ClipboardList,
    },
    {
      clave: "adherencia",
      etiqueta: "Adherencia parcial",
      valor: datos.adherenciaParcial,
      sufijo: datos.adherenciaParcial !== null ? " pts" : "",
      contexto:
        datos.cicloCompleto > 0
          ? `${datos.cicloCompleto} con presaber y postsaber`
          : "aún nadie completa el ciclo",
      Icono: TrendingUp,
      glow:
        datos.adherenciaParcial === null
          ? undefined
          : datos.adherenciaParcial > 0
            ? "glow-exito"
            : "glow-critico",
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">Jornada en vivo</h2>
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <RefreshCw
            className={cn("h-3 w-3", refrescando && !reducido && "animate-spin")}
            aria-hidden="true"
          />
          se actualiza sola
        </span>
      </div>

      {/* reducedMotion="user" lo resuelve DENTRO de framer: el marcado inicial
          es el mismo en servidor y cliente -si se ramificara aquí con
          useReducedMotion, el primero renderiza sin saber la preferencia y la
          hidratación no cuadra- y quien pide menos movimiento simplemente no
          ve el desplazamiento. */}
      <MotionConfig reducedMotion="user">
      <div className={cn("grid gap-4", conVideo ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4")}>
        {tarjetas.map((t, i) => (
          <motion.div
            key={t.clave}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
            className={cn("surface-vivo", t.glow)}
          >
            <div className="p-5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
                  <t.Icono className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
                </span>
                <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{t.etiqueta}</span>
              </div>
              <p className="mt-3 font-display text-[2.25rem] font-black leading-none tracking-tight">
                <Cifra valor={t.valor} sufijo={t.sufijo} reducido={reducido} />
              </p>
              <p className="mt-1.5 text-[12px] font-normal leading-snug text-muted-foreground/80">{t.contexto}</p>
            </div>
          </motion.div>
        ))}
      </div>
      </MotionConfig>
    </div>
  );
}
