"use client";

import { PieChart, Pie, Cell, Legend, ResponsiveContainer } from "recharts";
import type { TrainingActivityStatus } from "@prisma/client";

/**
 * Reutiliza los mismos colores de estado ya usados en los badges de
 * actividad (TRAINING_ACTIVITY_STATUS_CLASSES): no son categóricos nuevos,
 * son tokens de estado ya reservados en el resto del módulo. Validado con la
 * skill "dataviz" (separación CVD amplia: gris neutro + verde + navy, nunca
 * verde/rojo). Part-to-whole de ≤3 categorías: uso legítimo de pastel.
 */
const STATUS_COLORS: Record<TrainingActivityStatus, string> = {
  DRAFT: "var(--color-muted-foreground)",
  OPEN: "var(--color-success)",
  CLOSED: "var(--color-navy)",
};

export type ActivityStatusDatum = { status: TrainingActivityStatus; label: string; count: number };

export function ActivityStatusPieChart({ data }: { data: ActivityStatusDatum[] }) {
  const visible = data.filter((d) => d.count > 0);
  const total = visible.reduce((sum, d) => sum + d.count, 0);

  if (total === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Sin actividades todavía.</p>;
  }

  return (
    <div style={{ width: "100%", height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={visible}
            dataKey="count"
            nameKey="label"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={2}
            isAnimationActive={false}
            label={({ name, value }) => `${name}: ${value}`}
          >
            {visible.map((entry) => (
              <Cell key={entry.status} fill={STATUS_COLORS[entry.status]} stroke="var(--color-card)" strokeWidth={2} />
            ))}
          </Pie>
          <Legend verticalAlign="bottom" height={32} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
