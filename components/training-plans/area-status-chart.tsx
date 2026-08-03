"use client";

import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer, Tooltip } from "recharts";

export type AreaStatusDatum = { name: string; draft: number; open: number; closed: number };

/**
 * Estado de las jornadas POR ÁREA, apilado: cuántas siguen en borrador,
 * cuántas están abiertas y cuántas ya cerraron, área por área. Reemplaza a
 * la dona global, que con un plan recién montado (54 borradores, 1 abierta)
 * era un anillo gris que no orientaba ninguna decisión; aquí se ve QUIÉN
 * tiene lo suyo andando y quién no ha empezado.
 *
 * Colores de ESTADO ya reservados en el módulo (badges de actividad), no
 * categóricos nuevos.
 */
const COLOR = {
  draft: "var(--color-muted-foreground)",
  open: "var(--color-success)",
  closed: "var(--color-navy)",
};

export function AreaStatusChart({ data }: { data: AreaStatusDatum[] }) {
  const height = Math.max(160, data.length * 40 + 60);
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, bottom: 8, left: 8 }} barSize={16}>
          <CartesianGrid horizontal={false} stroke="var(--color-border)" />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }} axisLine={false} tickLine={false} />
          <YAxis
            type="category"
            dataKey="name"
            width={150}
            tick={{ fontSize: 11, fill: "var(--color-foreground)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "var(--color-border)", opacity: 0.3 }}
            contentStyle={{ backgroundColor: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="draft" name="Borrador" stackId="s" fill={COLOR.draft} isAnimationActive={false} />
          <Bar dataKey="open" name="Abierta" stackId="s" fill={COLOR.open} isAnimationActive={false} />
          <Bar dataKey="closed" name="Cerrada" stackId="s" fill={COLOR.closed} radius={[0, 4, 4, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
