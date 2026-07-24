"use client";

import dynamic from "next/dynamic";
import type { ChartPoint } from "@/components/dashboard/trend-chart";

/**
 * Carga diferida de la gráfica: es el único bloque del dashboard que arrastra
 * SVG interactivo y estado, y vive bajo el pliegue. Con dynamic() no entra al
 * bundle inicial de ninguna de las tres vistas (ver auditoría, P2).
 */
const TrendChart = dynamic(() => import("@/components/dashboard/trend-chart").then((m) => m.TrendChart), {
  loading: () => <div className="h-[248px] w-full animate-pulse rounded-xl bg-foreground/[0.06]" />,
});

export function ChartPanel({ points, seriesLabels }: { points: ChartPoint[]; seriesLabels: [string, string] }) {
  return <TrendChart points={points} seriesLabels={seriesLabels} />;
}
