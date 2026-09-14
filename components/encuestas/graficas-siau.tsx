"use client";

import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TonoOpcion } from "@/lib/encuestas/tipos";

/**
 * Gráficas del centro de datos SIAU (Recharts, tokens del sistema; los
 * únicos colores fijos son los de las caritas, que son semánticos).
 */

const EJE = { fontSize: 11, fill: "var(--muted-foreground)" };
const TOOLTIP = { borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)", fontSize: 12, color: "var(--foreground)" };

export const COLOR_TONO: Record<TonoOpcion, string> = { exc: "#1f9d5a", bue: "#2f80c2", reg: "#e0a11c", mal: "#e0642e", muymal: "#d64545", na: "#94a3b8" };

function colorSemaforo(v: number | null) {
  if (v === null) return "var(--muted-foreground)";
  return v >= 85 ? "var(--success)" : v >= 70 ? "var(--warning)" : "var(--destructive)";
}

export function LineaTendencia({ datos, referencia }: { datos: { etiqueta: string; adherencia: number | null; puntaje: number | null; total: number }[]; referencia?: number | null }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <LineChart data={datos} margin={{ top: 10, right: 16, bottom: 0, left: -14 }}>
          <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="etiqueta" tick={EJE} tickLine={false} axisLine={false} />
          <YAxis domain={[0, 100]} tick={EJE} tickLine={false} axisLine={false} unit="%" />
          <Tooltip contentStyle={TOOLTIP} formatter={(v, n) => [`${v}%`, String(n) === "adherencia" ? "Adherencia" : "Puntaje"]} labelFormatter={(l, p) => `${l} · ${p?.[0]?.payload?.total ?? 0} encuestas`} />
          <ReferenceLine y={85} stroke="var(--success)" strokeDasharray="3 3" />
          <ReferenceLine y={70} stroke="var(--warning)" strokeDasharray="3 3" />
          {referencia != null && <ReferenceLine y={referencia} stroke="var(--primary)" strokeDasharray="2 4" label={{ value: "institucional", fontSize: 10, fill: "var(--primary)", position: "insideTopRight" }} />}
          <Line type="monotone" dataKey="adherencia" stroke="var(--primary)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--primary)" }} connectNulls />
          <Line type="monotone" dataKey="puntaje" stroke="var(--success)" strokeWidth={1.8} strokeDasharray="5 3" dot={false} connectNulls />
          <Legend formatter={(v) => (v === "adherencia" ? "Adherencia %" : "Puntaje %")} wrapperStyle={{ fontSize: 11 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Distribución por carita de varias preguntas: barras apiladas 100 %. */
export function BarrasApiladasCaritas({ datos, tonos }: { datos: { nombre: string; [k: string]: number | string }[]; tonos: { clave: string; etiqueta: string; tono: TonoOpcion }[] }) {
  return (
    <div className="w-full" style={{ height: Math.max(180, datos.length * 44 + 60) }}>
      <ResponsiveContainer>
        <BarChart data={datos} layout="vertical" stackOffset="expand" margin={{ top: 4, right: 16, bottom: 0, left: 8 }} barCategoryGap={10}>
          <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" horizontal={false} />
          <XAxis type="number" tick={EJE} tickLine={false} axisLine={false} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
          <YAxis type="category" dataKey="nombre" width={150} tick={{ ...EJE, fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={TOOLTIP} formatter={(v, n) => [`${v}%`, tonos.find((t) => t.clave === String(n))?.etiqueta ?? String(n)]} />
          {tonos.map((t, i) => (
            <Bar key={t.clave} dataKey={t.clave} stackId="a" fill={COLOR_TONO[t.tono]} radius={i === tonos.length - 1 ? [0, 6, 6, 0] : 0} />
          ))}
          <Legend formatter={(v) => tonos.find((t) => t.clave === v)?.etiqueta ?? v} wrapperStyle={{ fontSize: 11 }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Ranking horizontal con semáforo (sedes, servicios, perfiles). */
export function BarrasRanking({ datos, referencia }: { datos: { nombre: string; valor: number | null; n: number }[]; referencia?: number | null }) {
  const filas = datos.map((d) => ({ ...d, valor: d.valor ?? 0 }));
  return (
    <div className="w-full" style={{ height: Math.max(160, filas.length * 30 + 40) }}>
      <ResponsiveContainer>
        <BarChart data={filas} layout="vertical" margin={{ top: 4, right: 40, bottom: 0, left: 8 }} barCategoryGap={6}>
          <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} tick={EJE} tickLine={false} axisLine={false} unit="%" />
          <YAxis type="category" dataKey="nombre" width={150} tick={{ ...EJE, fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={TOOLTIP} formatter={(v) => [`${v}%`, "Adherencia"]} labelFormatter={(l, p) => `${l} · ${p?.[0]?.payload?.n ?? 0} encuestas`} />
          {referencia != null && <ReferenceLine x={referencia} stroke="var(--primary)" strokeDasharray="3 3" />}
          <Bar dataKey="valor" radius={[0, 6, 6, 0]} label={{ position: "right", fontSize: 11, fill: "var(--foreground)", formatter: (v: unknown) => `${v}%` }}>
            {filas.map((d) => (
              <Cell key={d.nombre} fill={colorSemaforo(d.valor)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
