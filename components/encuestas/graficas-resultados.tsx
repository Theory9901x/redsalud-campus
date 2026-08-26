"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * Gráficas del panel de resultados, con Recharts (ya en el proyecto).
 * Los colores salen del acento de la propia encuesta y de los tokens del
 * sistema, no de una paleta aparte.
 */

export function GraficaEvolucion({ datos, acento }: { datos: { fecha: string; conteo: number }[]; acento: string }) {
  return (
    <div className="mt-3 h-56 w-full">
      <ResponsiveContainer>
        <LineChart data={datos} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
          <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "var(--card)",
              fontSize: 12,
            }}
            labelStyle={{ color: "var(--foreground)", fontWeight: 600 }}
          />
          <Line type="monotone" dataKey="conteo" name="Respuestas" stroke={acento} strokeWidth={2.5} dot={{ r: 3, fill: acento }} />
        </LineChart>
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
  return (
    <div className="space-y-2.5">
      {opciones.map((o) => {
        const pct = total > 0 ? Math.round((o.conteo / total) * 100) : 0;
        return (
          <div key={o.id}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="min-w-0 truncate text-[13px] text-foreground">
                {o.texto}
                {o.esCorrecta && (
                  <span className="ml-1.5 text-[11px] font-bold" style={{ color: acento }}>
                    ✓ correcta
                  </span>
                )}
              </p>
              <p className="shrink-0 text-[12px] font-semibold tabular-nums text-muted-foreground">
                {o.conteo} ({pct}%)
              </p>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{ width: `${pct}%`, backgroundColor: o.esCorrecta ? acento : `${acento}66` }}
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
        <p className="mb-2 text-[13px] text-muted-foreground">
          Promedio: <span className="font-display text-lg font-extrabold text-foreground">{promedio}</span>
        </p>
      )}
      <div className="h-48 w-full">
        <ResponsiveContainer>
          <BarChart data={distribucion} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
            <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="valor" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "var(--card)",
                fontSize: 12,
              }}
              labelStyle={{ color: "var(--foreground)", fontWeight: 600 }}
            />
            <Bar dataKey="conteo" name="Respuestas" fill={acento} radius={[6, 6, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
