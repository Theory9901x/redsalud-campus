"use client";

import { PieChart, Pie, Cell, Legend, ResponsiveContainer } from "recharts";

/**
 * Con contenido vs. sin contenido: dos categorías, part-to-whole, uso
 * legítimo de dona (skill "dataviz"). Colores de ESTADO, no categóricos:
 * verde es "cumplido", ámbar es "pendiente" -los mismos tokens que ya usan
 * los badges de actividad en todo el módulo, no un color nuevo inventado
 * para este gráfico.
 */
const COLORES = { conContenido: "var(--color-success)", sinContenido: "var(--color-warning)" };

export function ContentCoverageChart({ conContenido, sinContenido }: { conContenido: number; sinContenido: number }) {
  const total = conContenido + sinContenido;
  if (total === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Sin capacitaciones todavía.</p>;
  }

  const datos = [
    { key: "conContenido", label: "Con contenido", value: conContenido },
    { key: "sinContenido", label: "Sin contenido todavía", value: sinContenido },
  ].filter((d) => d.value > 0);

  return (
    <div style={{ width: "100%", height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={datos}
            dataKey="value"
            nameKey="label"
            innerRadius={56}
            outerRadius={84}
            paddingAngle={2}
            isAnimationActive={false}
            label={({ value }) => `${value}`}
          >
            {datos.map((d) => (
              <Cell key={d.key} fill={COLORES[d.key as keyof typeof COLORES]} stroke="var(--color-card)" strokeWidth={2} />
            ))}
          </Pie>
          <Legend verticalAlign="bottom" height={32} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
