"use client";

import { Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TonoOpcion } from "@/lib/encuestas/tipos";
import { COLOR_SEM, COLOR_TONO, semDe } from "@/components/encuestas/siau/semaforo";

/**
 * Gráficas del centro de datos SIAU (Recharts) con el mismo lenguaje de la
 * página: trazos finos, ejes en monoespaciada, barras redondeadas, un solo
 * acento cian. Los únicos colores fijos son semánticos: el semáforo
 * institucional y la escala de caritas (de verde a rojo).
 */

const EJE = { fontSize: 10.5, fill: "var(--muted-foreground)", fontFamily: "var(--font-mono)" };
const REJILLA = "color-mix(in oklch, var(--foreground) 8%, transparent)";

export { COLOR_TONO };

type Punto = { etiqueta: string; adherencia: number | null; puntaje: number | null; total: number };

export function LineaTendencia({ datos, referencia }: { datos: Punto[]; referencia?: number | null }) {
  return (
    <div className="siau-grafica h-full min-h-64 w-full">
      <ResponsiveContainer>
        <ComposedChart data={datos} margin={{ top: 12, right: 12, bottom: 0, left: -18 }}>
          <defs>
            <linearGradient id="siau-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={REJILLA} strokeDasharray="2 6" vertical={false} />
          <XAxis dataKey="etiqueta" tick={EJE} tickLine={false} axisLine={false} dy={6} />
          <YAxis domain={[0, 100]} ticks={[0, 25, 50, 70, 85, 100]} tick={EJE} tickLine={false} axisLine={false} unit="%" />
          <Tooltip
            cursor={{ stroke: "color-mix(in oklch, var(--primary) 40%, transparent)", strokeWidth: 1 }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0]?.payload as Punto | undefined;
              return (
                <div className="siau-tooltip">
                  <p>
                    {label} · {p?.total ?? 0} encuestas
                  </p>
                  <span>
                    <span>
                      <i style={{ background: "var(--primary)" }} />
                      Adherencia
                    </span>
                    <b>{p?.adherencia ?? "—"}%</b>
                  </span>
                  <span>
                    <span>
                      <i style={{ background: "var(--muted-foreground)" }} />
                      Puntaje
                    </span>
                    <b>{p?.puntaje ?? "—"}%</b>
                  </span>
                </div>
              );
            }}
          />
          <ReferenceLine y={85} stroke={COLOR_SEM.verde} strokeOpacity={0.7} strokeDasharray="3 5" />
          <ReferenceLine y={70} stroke={COLOR_SEM.amarillo} strokeOpacity={0.8} strokeDasharray="3 5" />
          {referencia != null && (
            <ReferenceLine
              y={referencia}
              stroke="var(--foreground)"
              strokeOpacity={0.35}
              strokeDasharray="1 4"
              label={{ value: `anterior ${referencia}%`, fontSize: 10, fill: "var(--muted-foreground)", position: "insideBottomRight" }}
            />
          )}
          <Area type="monotone" dataKey="adherencia" stroke="var(--primary)" strokeWidth={2} fill="url(#siau-area)" dot={{ r: 3, fill: "var(--card)", stroke: "var(--primary)", strokeWidth: 2 }} activeDot={{ r: 5, fill: "var(--primary)", stroke: "var(--card)", strokeWidth: 2 }} connectNulls />
          <Line type="monotone" dataKey="puntaje" stroke="var(--muted-foreground)" strokeOpacity={0.7} strokeWidth={1.4} strokeDasharray="4 4" dot={false} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Distribución por carita de varias preguntas: barras apiladas 100 %. */
export function BarrasApiladasCaritas({ datos, tonos }: { datos: { nombre: string; [k: string]: number | string }[]; tonos: { clave: string; etiqueta: string; tono: TonoOpcion }[] }) {
  return (
    <div className="siau-grafica w-full" style={{ height: Math.max(180, datos.length * 38 + 40) }}>
      <ResponsiveContainer>
        <BarChart data={datos} layout="vertical" stackOffset="expand" margin={{ top: 4, right: 12, bottom: 0, left: 4 }} barCategoryGap={9}>
          <CartesianGrid stroke={REJILLA} strokeDasharray="2 6" horizontal={false} />
          <XAxis type="number" tick={EJE} tickLine={false} axisLine={false} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
          <YAxis type="category" dataKey="nombre" width={140} tick={EJE} tickLine={false} axisLine={false} />
          <Tooltip cursor={{ fill: "color-mix(in oklch, var(--primary) 6%, transparent)" }} contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)", fontSize: 12, color: "var(--foreground)" }} formatter={(v, n) => [`${v}%`, tonos.find((t) => t.clave === String(n))?.etiqueta ?? String(n)]} />
          {tonos.map((t, i) => (
            <Bar key={t.clave} dataKey={t.clave} stackId="a" fill={COLOR_TONO[t.tono]} radius={i === 0 ? [6, 0, 0, 6] : i === tonos.length - 1 ? [0, 6, 6, 0] : 0} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Ranking horizontal con semáforo (barras redondeadas, color pleno). */
export function BarrasRanking({ datos, referencia }: { datos: { nombre: string; valor: number | null; n: number }[]; referencia?: number | null }) {
  const filas = datos.map((d) => ({ ...d, valor: d.valor ?? 0 }));
  return (
    <div className="siau-grafica w-full" style={{ height: Math.max(160, filas.length * 30 + 40) }}>
      <ResponsiveContainer>
        <BarChart data={filas} layout="vertical" margin={{ top: 4, right: 40, bottom: 0, left: 4 }} barCategoryGap={8}>
          <CartesianGrid stroke={REJILLA} strokeDasharray="2 6" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} tick={EJE} tickLine={false} axisLine={false} unit="%" />
          <YAxis type="category" dataKey="nombre" width={140} tick={EJE} tickLine={false} axisLine={false} />
          <Tooltip cursor={{ fill: "color-mix(in oklch, var(--primary) 6%, transparent)" }} contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)", fontSize: 12, color: "var(--foreground)" }} formatter={(v) => [`${v}%`, "Adherencia"]} />
          {referencia != null && <ReferenceLine x={referencia} stroke="var(--foreground)" strokeOpacity={0.4} strokeDasharray="2 4" />}
          <Bar dataKey="valor" radius={[0, 999, 999, 0]} barSize={12} label={{ position: "right", fontSize: 10.5, fontFamily: "var(--font-mono)", fill: "var(--foreground)", formatter: (v: unknown) => `${v}%` }}>
            {filas.map((d) => (
              <Cell key={d.nombre} fill={COLOR_SEM[semDe(d.valor)]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
