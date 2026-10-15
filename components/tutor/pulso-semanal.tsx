"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type PuntoPulso = { etiqueta: string; rango: string; asistencias: number; evaluaciones: number };

const SERIES = [
  { clave: "asistencias", nombre: "Asistencias registradas", color: "var(--color-primary)" },
  { clave: "evaluaciones", nombre: "Evaluaciones presentadas", color: "var(--color-success)" },
] as const;

/**
 * PULSO DE PARTICIPACIÓN: doce semanas de asistencias y evaluaciones en las
 * capacitaciones del tutor. Dos series de la misma magnitud (personas por
 * semana) sobre UN eje; trazo fino de 2px, área con degradado tenue, ejes en
 * monoespaciada recesivos, leyenda siempre visible y tooltip con cursor.
 * Las etiquetas de semana llegan ya formateadas del servidor (sin Intl aquí:
 * evita diferencias de hidratación entre Node y el navegador).
 */
export function PulsoSemanal({ datos }: { datos: PuntoPulso[] }) {
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-muted-foreground">
        {SERIES.map((s) => (
          <span key={s.clave} className="inline-flex items-center gap-1.5">
            <span className="h-[3px] w-3.5 rounded-full" style={{ background: s.color }} aria-hidden="true" />
            {s.nombre}
          </span>
        ))}
      </div>
      <div className="h-[220px] w-full" role="img" aria-label="Asistencias y evaluaciones por semana, últimas doce semanas">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={datos} margin={{ top: 8, right: 18, bottom: 0, left: -18 }}>
            <defs>
              {SERIES.map((s) => (
                <linearGradient key={s.clave} id={`pulso-${s.clave}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="2 4" />
            <XAxis
              dataKey="etiqueta"
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={18}
              tick={{ fontSize: 10, fill: "var(--color-muted-foreground)", fontFamily: "var(--font-mono)" }}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              width={42}
              tick={{ fontSize: 10, fill: "var(--color-muted-foreground)", fontFamily: "var(--font-mono)" }}
            />
            <Tooltip
              cursor={{ stroke: "var(--color-primary)", strokeWidth: 1, strokeDasharray: "3 3" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as PuntoPulso;
                return (
                  <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
                    <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Semana {p.rango}</p>
                    {SERIES.map((s) => (
                      <p key={s.clave} className="mt-1 flex items-center justify-between gap-4 text-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} aria-hidden="true" />
                          {s.nombre}
                        </span>
                        <b className="font-mono tabular-nums">{p[s.clave]}</b>
                      </p>
                    ))}
                  </div>
                );
              }}
            />
            {SERIES.map((s) => (
              <Area
                key={s.clave}
                type="monotone"
                dataKey={s.clave}
                name={s.nombre}
                stroke={s.color}
                strokeWidth={2}
                fill={`url(#pulso-${s.clave})`}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--color-card)" }}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
