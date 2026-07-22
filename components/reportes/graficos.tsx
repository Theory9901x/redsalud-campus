"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * Gráficos del centro de reportes (Recharts), tematizados con los tokens de
 * marca en vez de la paleta por defecto de la librería. Se cargan con
 * dynamic() desde los paneles para no engordar el bundle inicial.
 *
 * Todo el texto va en español y los números en formato de Colombia.
 */

const EJE = { fontSize: 11, fill: "var(--muted-foreground)" };
const nf = new Intl.NumberFormat("es-CO");

/** Tooltip con la superficie del sistema, no la caja blanca por defecto. */
const tooltipProps = {
  contentStyle: {
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--card)",
    fontSize: 12,
    boxShadow: "0 8px 24px -12px rgba(0,0,0,.25)",
  },
  labelStyle: { color: "var(--foreground)", fontWeight: 600 },
} as const;

/** Barras de cumplimiento (%) con color según qué tan bajo esté. */
export function BarrasCumplimiento({
  datos,
  maximo = 12,
}: {
  datos: { etiqueta: string; personas: number; completaron: number }[];
  /** Barras a mostrar. Con más de una docena las etiquetas se encabalgan y el
   *  gráfico deja de leerse; el resto se resume en una barra "Otros". */
  maximo?: number;
}) {
  const ordenados = [...datos].sort((a, b) => b.personas - a.personas);
  const visibles = ordenados.slice(0, maximo);
  const resto = ordenados.slice(maximo);
  if (resto.length > 0) {
    visibles.push({
      etiqueta: `Otros (${resto.length})`,
      personas: resto.reduce((s, d) => s + d.personas, 0),
      completaron: resto.reduce((s, d) => s + d.completaron, 0),
    });
  }
  const filas = visibles.map((d) => ({
    ...d,
    pct: d.personas > 0 ? Math.round((d.completaron / d.personas) * 100) : 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(220, filas.length * 40)}>
      <BarChart data={filas} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke="var(--border)" />
        <XAxis type="number" domain={[0, 100]} unit="%" tick={EJE} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="etiqueta" width={180} tick={EJE} axisLine={false} tickLine={false} interval={0} />
        <Tooltip
          {...tooltipProps}
          formatter={(valor, _nombre, item) => {
            const fila = (item as { payload?: { completaron: number; personas: number } }).payload;
            return [
              `${Number(valor)}% · ${nf.format(fila?.completaron ?? 0)} de ${nf.format(fila?.personas ?? 0)}`,
              "Cumplimiento",
            ];
          }}
        />
        <Bar dataKey="pct" radius={[0, 6, 6, 0]} isAnimationActive={false}>
          {filas.map((f) => (
            <Cell
              key={f.etiqueta}
              fill={f.pct >= 80 ? "var(--success)" : f.pct >= 40 ? "var(--warning)" : "var(--destructive)"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Barras simples de conteo (certificados por municipio o curso). */
export function BarrasConteo({
  datos,
  etiquetaSerie,
}: {
  datos: { etiqueta: string; certificados: number }[];
  etiquetaSerie: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, datos.length * 34)}>
      <BarChart data={datos} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke="var(--border)" />
        <XAxis type="number" allowDecimals={false} tick={EJE} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="etiqueta" width={150} tick={EJE} axisLine={false} tickLine={false} />
        <Tooltip {...tooltipProps} formatter={(valor) => [nf.format(Number(valor)), etiquetaSerie]} />
        <Bar dataKey="certificados" fill="var(--primary)" radius={[0, 6, 6, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Evolución temporal: inscripciones y certificados en área con degradado. */
export function AreaActividad({
  datos,
}: {
  datos: { fecha: string; inscripciones: number; certificados: number }[];
}) {
  const fmtFecha = (iso: string) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString("es-CO", { day: "numeric", month: "short" });

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={datos} margin={{ left: 0, right: 12, top: 8, bottom: 4 }}>
        <defs>
          <linearGradient id="gInsc" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.3} />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gCert" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--success)" stopOpacity={0.3} />
            <stop offset="100%" stopColor="var(--success)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="fecha" tickFormatter={fmtFecha} tick={EJE} axisLine={false} tickLine={false} minTickGap={40} />
        <YAxis allowDecimals={false} tick={EJE} axisLine={false} tickLine={false} width={32} />
        <Tooltip {...tooltipProps} labelFormatter={(etiqueta) => fmtFecha(String(etiqueta))} formatter={(valor) => nf.format(Number(valor))} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Area
          type="monotone"
          dataKey="inscripciones"
          name="Inscripciones"
          stroke="var(--primary)"
          strokeWidth={2}
          fill="url(#gInsc)"
          isAnimationActive={false}
        />
        <Area
          type="monotone"
          dataKey="certificados"
          name="Certificados"
          stroke="var(--success)"
          strokeWidth={2}
          fill="url(#gCert)"
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
