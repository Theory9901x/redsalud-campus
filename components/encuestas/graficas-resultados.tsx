"use client";

import { useId } from "react";
import { Check } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * Gráficas del panel de resultados, con Recharts (ya en el proyecto).
 * Los colores salen del acento de la propia encuesta y de los tokens del
 * sistema, no de una paleta aparte. Ejes y cifras en monoespaciada, como el
 * resto del centro de mando.
 */

const EJE = { fontSize: 10.5, fill: "var(--muted-foreground)", fontFamily: "var(--font-mono)" };
const TOOLTIP = {
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--card)",
  fontSize: 12,
  boxShadow: "0 12px 28px -16px rgba(13, 42, 76, 0.45)",
};

export function GraficaEvolucion({ datos, acento }: { datos: { fecha: string; conteo: number }[]; acento: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <div className="mt-4 h-56 w-full">
      <ResponsiveContainer>
        <AreaChart data={datos} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
          <defs>
            <linearGradient id={`evol-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={acento} stopOpacity={0.32} />
              <stop offset="100%" stopColor={acento} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 5" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="fecha" tick={EJE} tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tick={EJE} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={TOOLTIP} labelStyle={{ color: "var(--foreground)", fontWeight: 600 }} />
          <Area
            type="monotone"
            dataKey="conteo"
            name="Respuestas"
            stroke={acento}
            strokeWidth={2.25}
            fill={`url(#evol-${id})`}
            dot={{ r: 2.5, fill: acento, strokeWidth: 0 }}
            activeDot={{ r: 4.5, strokeWidth: 2, stroke: "var(--card)" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function GraficaOpciones({
  opciones,
  acento,
}: {
  opciones: { id: string; texto: string; conteo: number; esCorrecta: boolean }[];
  acento: string;
}) {
  const total = opciones.reduce((s, o) => s + o.conteo, 0);
  const maximo = Math.max(0, ...opciones.map((o) => o.conteo));
  return (
    <div className="space-y-2.5">
      {opciones.map((o) => {
        const pct = total > 0 ? Math.round((o.conteo / total) * 100) : 0;
        const lider = maximo > 0 && o.conteo === maximo;
        return (
          <div key={o.id}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-foreground">
                <span className="truncate" title={o.texto}>{o.texto}</span>
                {o.esCorrecta && (
                  <span
                    className="inline-flex shrink-0 items-center gap-0.5 rounded px-1 font-mono text-[9.5px] font-semibold uppercase tracking-[0.1em]"
                    style={{ color: acento, backgroundColor: `color-mix(in oklch, ${acento} 10%, transparent)` }}
                  >
                    <Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden="true" />
                    correcta
                  </span>
                )}
              </p>
              <p className="shrink-0 font-mono text-[11.5px] tabular-nums text-muted-foreground">
                <b className="font-semibold text-foreground">{o.conteo}</b> · {pct}%
              </p>
            </div>
            <div className="enc-barra mt-1">
              <span
                style={{
                  width: `${pct}%`,
                  ["--c" as string]: o.esCorrecta || lider ? acento : `color-mix(in oklch, ${acento} 55%, var(--muted-foreground))`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function GraficaDistribucion({
  distribucion,
  promedio,
  acento,
}: {
  distribucion: { valor: number; conteo: number }[];
  promedio: number | null;
  acento: string;
}) {
  return (
    <div>
      {promedio !== null && (
        <p className="mb-2 flex items-baseline gap-2">
          <span className="mono-label">Promedio</span>
          <span className="font-mono text-lg font-semibold tabular-nums text-foreground">{promedio}</span>
        </p>
      )}
      <div className="h-48 w-full">
        <ResponsiveContainer>
          <BarChart data={distribucion} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
            <CartesianGrid strokeDasharray="3 5" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="valor" tick={EJE} tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} tick={EJE} tickLine={false} axisLine={false} />
            <Tooltip
              cursor={{ fill: "color-mix(in oklch, var(--primary) 6%, transparent)" }}
              contentStyle={TOOLTIP}
              labelStyle={{ color: "var(--foreground)", fontWeight: 600 }}
            />
            <Bar dataKey="conteo" name="Respuestas" fill={acento} radius={[5, 5, 0, 0]} maxBarSize={44} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
