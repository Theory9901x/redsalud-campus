"use client";

import { Bar, BarChart, XAxis, YAxis, CartesianGrid, LabelList, ResponsiveContainer } from "recharts";

export type AdherenceBarDatum = { label: string; percentage: number };

/**
 * Magnitud de una sola serie (adherencia %) comparada entre categorías: un
 * solo tono (primary), sin leyenda (el título ya dice qué se mide), % directo
 * en la punta de cada barra. Horizontal para que quepan nombres largos de
 * actividad. Ver skill "dataviz": sequential = un hue, nunca arcoíris.
 */
export function AdherenceBarChart({ data }: { data: AdherenceBarDatum[] }) {
  const height = Math.max(120, data.length * 44 + 40);

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 36, bottom: 8, left: 8 }}>
          <CartesianGrid horizontal={false} stroke="var(--color-border)" />
          <XAxis
            type="number"
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={180}
            tick={{ fontSize: 12, fill: "var(--color-foreground)" }}
            axisLine={false}
            tickLine={false}
          />
          <Bar dataKey="percentage" fill="var(--color-primary)" radius={[0, 4, 4, 0]} barSize={20} isAnimationActive={false}>
            <LabelList
              dataKey="percentage"
              position="right"
              formatter={(value: string | number | boolean | null | undefined) => `${value ?? 0}%`}
              style={{ fill: "var(--color-foreground)", fontSize: 12, fontWeight: 600 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
