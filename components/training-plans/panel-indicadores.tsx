"use client";

import { useState } from "react";
import { MotionConfig, motion } from "framer-motion";
import { TrendingUp, Layers, Users2, Info } from "lucide-react";
import type { PlanIndicadores, Indicadores } from "@/lib/plan-indicadores";
import { semaforo, UMBRAL_VERDE, UMBRAL_AMARILLO, type Semaforo } from "@/lib/semaforo-indicadores";
import { cn } from "@/lib/utils";

const ROMANO = ["I", "II", "III", "IV"];

const GLOW: Record<Semaforo, string> = {
  verde: "glow-exito",
  amarillo: "glow-alerta",
  rojo: "glow-critico",
  "sin-datos": "",
};

const TEXTO_SEMAFORO: Record<Semaforo, string> = {
  verde: "text-success",
  amarillo: "text-warning-foreground",
  rojo: "text-destructive",
  "sin-datos": "text-muted-foreground",
};

const ETIQUETA_SEMAFORO: Record<Semaforo, string> = {
  verde: `Cumple (≥${UMBRAL_VERDE}%)`,
  amarillo: `En alerta (${UMBRAL_AMARILLO}–${UMBRAL_VERDE - 0.1}%)`,
  rojo: `Crítico (<${UMBRAL_AMARILLO}%)`,
  "sin-datos": "Sin datos todavía",
};

/**
 * Indicadores del plan.
 *
 * La adherencia manda: va sola, al doble de tamaño y con la cifra en
 * gradiente; cobertura y asistencia acompañan con la misma piel pero menor
 * jerarquía tipográfica, para que nunca compitan con ella.
 *
 * Los trimestres van en un selector y no como cuatro filas apiladas: las
 * cuatro a la vez saturan el panel y obligan a leer doce cifras para
 * responder una sola pregunta.
 */
export function PanelIndicadores({ datos }: { datos: PlanIndicadores }) {
  const [corte, setCorte] = useState<number | "anual">("anual");
  const actual: Indicadores =
    corte === "anual"
      ? datos.anual
      : datos.porTrimestre.find((t) => t.trimestre === corte)?.indicadores ?? datos.anual;

  const sAdh = semaforo(actual.adherencia.valor);
  const sCob = semaforo(actual.cobertura.valor);
  const sAsi = semaforo(actual.asistencia.valor);

  const cortes: { clave: number | "anual"; etiqueta: string }[] = [
    { clave: "anual", etiqueta: "Acumulado año" },
    ...[1, 2, 3, 4].map((t) => ({ clave: t as number, etiqueta: `T${ROMANO[t - 1]}` })),
  ];

  return (
    <MotionConfig reducedMotion="user">
      <div className="space-y-6">
        {/* Selector de corte */}
        <div className="flex flex-wrap items-center gap-2">
          {cortes.map((c) => (
            <button
              key={String(c.clave)}
              type="button"
              onClick={() => setCorte(c.clave)}
              aria-pressed={corte === c.clave}
              className={cn(
                "rounded-full border px-4 py-2 text-xs font-bold transition-colors",
                corte === c.clave
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border/60 bg-card/70 text-muted-foreground hover:text-foreground"
              )}
            >
              {c.etiqueta}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          {/* PRINCIPAL — adherencia institucional */}
          <motion.div
            key={`adh-${String(corte)}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className={cn("surface-vivo xl:col-span-2", GLOW[sAdh])}
          >
            <div className="flex h-full flex-col justify-between gap-5 p-6 sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/12 text-primary">
                    <TrendingUp className="h-5 w-5" strokeWidth={1.9} aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                      Indicador principal
                    </p>
                    <p className="font-display text-[15px] font-bold text-foreground">
                      Adherencia institucional del conocimiento
                    </p>
                  </div>
                </div>
                <span className={cn("shrink-0 text-[11px] font-bold", TEXTO_SEMAFORO[sAdh])}>
                  {ETIQUETA_SEMAFORO[sAdh]}
                </span>
              </div>

              <div>
                <p className="font-display text-[clamp(3rem,7vw,4.25rem)] font-black leading-none tracking-tight">
                  <span className="cifra-vivo tabular-nums">
                    {actual.adherencia.valor === null ? "—" : `${actual.adherencia.valor > 0 ? "+" : ""}${actual.adherencia.valor}`}
                  </span>
                  {actual.adherencia.valor !== null && (
                    <span className="ml-1 text-2xl font-bold text-muted-foreground">pp</span>
                  )}
                </p>
                <p className="mt-2 text-[13px] text-muted-foreground">
                  {actual.adherencia.valor === null
                    ? "Aún nadie completa presaber y postsaber en una jornada cerrada."
                    : `Mejora promedio entre presaber y postsaber · ${actual.adherencia.personas} personas con el ciclo completo en ${actual.adherencia.actividadesCerradas} ${actual.adherencia.actividadesCerradas === 1 ? "jornada cerrada" : "jornadas cerradas"}.`}
                </p>
              </div>

              <p className="flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground/80">
                <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                ((Postsaber − Presaber) ÷ Presaber) × 100, por persona y promediado. Solo jornadas cerradas; el
                resultado queda congelado con el informe de cada jornada.
              </p>
            </div>
          </motion.div>

          {/* SECUNDARIOS */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-1">
            {[
              {
                clave: "cobertura",
                titulo: "Cobertura de contenido",
                Icono: Layers,
                valor: actual.cobertura.valor,
                sem: sCob,
                detalle: `${actual.cobertura.conContenido} de ${actual.cobertura.total} líneas del PIC con curso montado`,
              },
              {
                clave: "asistencia",
                titulo: "Asistencia efectiva",
                Icono: Users2,
                valor: actual.asistencia.valor,
                sem: sAsi,
                detalle: `${actual.asistencia.asistentes} de ${actual.asistencia.audiencia} personas convocadas`,
              },
            ].map((s, i) => (
              <motion.div
                key={`${s.clave}-${String(corte)}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.32, delay: 0.05 * (i + 1), ease: [0.22, 1, 0.36, 1] }}
                className={cn("surface-vivo", GLOW[s.sem])}
              >
                <div className="flex h-full flex-col justify-between gap-3 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/12 text-primary">
                        <s.Icono className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />
                      </span>
                      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{s.titulo}</p>
                    </div>
                    <span className={cn("shrink-0 text-[10px] font-bold", TEXTO_SEMAFORO[s.sem])}>
                      {s.sem === "sin-datos" ? "—" : `${s.valor}%`}
                    </span>
                  </div>
                  <div>
                    <p className="font-display text-[2rem] font-extrabold leading-none tracking-tight text-foreground tabular-nums">
                      {s.valor}
                      <span className="text-lg text-muted-foreground">%</span>
                    </p>
                    <p className="mt-1.5 text-[12px] leading-snug text-muted-foreground">{s.detalle}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Desagregación por área: el detalle debajo, no compitiendo arriba. */}
        {datos.porArea.length > 1 && (
          <section aria-label="Indicadores por área" className="surface-lumen overflow-hidden">
            <div className="border-b border-border/60 px-5 py-3.5">
              <h3 className="font-display text-sm font-bold text-foreground">Por área · acumulado del año</h3>
              <p className="text-[11px] text-muted-foreground">
                Las mismas tres fórmulas, aplicadas al universo de cada área.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="px-5 py-2.5 font-bold">Área</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-bold">Adherencia</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-bold">Cobertura</th>
                    <th scope="col" className="px-5 py-2.5 text-right font-bold">Asistencia</th>
                  </tr>
                </thead>
                <tbody>
                  {datos.porArea.map((a) => (
                    <tr key={a.areaId} className="border-b border-border/40 last:border-0">
                      <td className="px-5 py-3 font-medium text-foreground">{a.areaNombre}</td>
                      <td className={cn("px-3 py-3 text-right font-bold tabular-nums", TEXTO_SEMAFORO[semaforo(a.adherencia.valor)])}>
                        {a.adherencia.valor === null ? "—" : `${a.adherencia.valor > 0 ? "+" : ""}${a.adherencia.valor} pp`}
                      </td>
                      <td className={cn("px-3 py-3 text-right font-bold tabular-nums", TEXTO_SEMAFORO[semaforo(a.cobertura.valor)])}>
                        {a.cobertura.valor}%
                        <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                          ({a.cobertura.conContenido}/{a.cobertura.total})
                        </span>
                      </td>
                      <td className={cn("px-5 py-3 text-right font-bold tabular-nums", TEXTO_SEMAFORO[semaforo(a.asistencia.valor)])}>
                        {a.asistencia.valor}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </MotionConfig>
  );
}
