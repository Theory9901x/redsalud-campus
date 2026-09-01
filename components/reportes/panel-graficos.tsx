"use client";

import dynamic from "next/dynamic";

/**
 * Carga diferida de los gráficos: Recharts es la dependencia más pesada del
 * módulo y ninguno de estos paneles se ve sin desplazarse, así que no entra
 * al bundle inicial de la vista.
 */
const cargando = () => <div className="h-56 w-full animate-pulse rounded-xl bg-foreground/[0.06]" />;

export const BarrasCumplimiento = dynamic(
  () => import("@/components/reportes/graficos").then((m) => m.BarrasCumplimiento),
  { loading: cargando }
);
export const BarrasConteo = dynamic(
  () => import("@/components/reportes/graficos").then((m) => m.BarrasConteo),
  { loading: cargando }
);
export const AreaActividad = dynamic(
  () => import("@/components/reportes/graficos").then((m) => m.AreaActividad),
  { loading: cargando }
);
export const LineaMensual = dynamic(
  () => import("@/components/reportes/graficos").then((m) => m.LineaMensual),
  { loading: cargando }
);
export const Sparkline = dynamic(
  () => import("@/components/reportes/graficos").then((m) => m.Sparkline),
  { loading: () => <div className="h-[34px]" /> }
);
export const DonaGrupos = dynamic(
  () => import("@/components/reportes/graficos").then((m) => m.DonaGrupos),
  { loading: cargando }
);
export const Cohortes = dynamic(
  () => import("@/components/reportes/graficos").then((m) => m.Cohortes),
  { loading: cargando }
);
