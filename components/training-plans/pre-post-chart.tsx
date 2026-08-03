"use client";

import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer, Tooltip, LabelList } from "recharts";

export type PrePostDatum = { titulo: string; pre: number | null; post: number | null };

/**
 * Presaber vs postsaber por capacitación: el ANTES y el DESPUÉS lado a lado,
 * que es el número que este módulo existe para producir. Dos series con
 * leyenda: el presaber en el azul primario, el postsaber en verde -el color
 * de "objetivo cumplido" del sistema-, nunca solo el color como distinción
 * (la leyenda y el tooltip siempre nombran la serie).
 */
export function PrePostChart({ data }: { data: PrePostDatum[] }) {
  const height = Math.max(180, data.length * 56 + 60);
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 40, bottom: 8, left: 8 }} barGap={2} barSize={14}>
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
            dataKey="titulo"
            width={170}
            tick={{ fontSize: 11, fill: "var(--color-foreground)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "var(--color-border)", opacity: 0.3 }}
            formatter={(v) => `${v ?? 0}%`}
            contentStyle={{ backgroundColor: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="pre" name="Presaber" fill="var(--color-primary)" radius={[0, 3, 3, 0]} isAnimationActive={false}>
            <LabelList dataKey="pre" position="right" formatter={(v: number | string | boolean | null | undefined) => (v === null || v === undefined ? "" : `${v}%`)} style={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} />
          </Bar>
          <Bar dataKey="post" name="Postsaber" fill="var(--color-success)" radius={[0, 3, 3, 0]} isAnimationActive={false}>
            <LabelList dataKey="post" position="right" formatter={(v: number | string | boolean | null | undefined) => (v === null || v === undefined ? "" : `${v}%`)} style={{ fill: "var(--color-foreground)", fontSize: 11, fontWeight: 600 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
