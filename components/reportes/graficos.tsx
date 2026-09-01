"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
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


const MES_CORTO = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const fmtMes = (m: string) => {
  const [a, mm] = m.split("-");
  return `${MES_CORTO[Number(mm) - 1] ?? mm} ${a.slice(2)}`;
};

/** Evolución mensual: inscripciones, finalizaciones y certificados. */
export function LineaMensual({
  datos,
  alto = 260,
}: {
  datos: { mes: string; inscripciones: number; completadas: number; certificados: number }[];
  alto?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={alto}>
      <LineChart data={datos} margin={{ left: 0, right: 12, top: 8, bottom: 4 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="mes" tickFormatter={fmtMes} tick={EJE} axisLine={false} tickLine={false} minTickGap={24} />
        <YAxis allowDecimals={false} tick={EJE} axisLine={false} tickLine={false} width={32} />
        <Tooltip {...tooltipProps} labelFormatter={(v) => fmtMes(String(v))} formatter={(valor) => nf.format(Number(valor))} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="inscripciones" name="Inscripciones" stroke="var(--primary)" strokeWidth={2.2} dot={false} isAnimationActive={false} />
        <Line type="monotone" dataKey="completadas" name="Finalizadas" stroke="var(--success)" strokeWidth={2.2} dot={false} isAnimationActive={false} />
        <Line type="monotone" dataKey="certificados" name="Certificados" stroke="var(--warning)" strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Mini-tendencia para los KPI: sin ejes, solo la forma. */
export function Sparkline({
  datos,
  dataKey,
  color,
}: {
  datos: Record<string, unknown>[];
  dataKey: string;
  color: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={34}>
      <AreaChart data={datos} margin={{ left: 0, right: 0, top: 2, bottom: 0 }}>
        <defs>
          <linearGradient id={`spark-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.8} fill={`url(#spark-${dataKey})`} dot={false} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Dona de distribución por grupo poblacional, con el total en el centro. */
export function DonaGrupos({ datos }: { datos: { etiqueta: string; personas: number }[] }) {
  const COLORES = ["var(--primary)", "var(--accent)", "var(--warning)"];
  const total = datos.reduce((s, d) => s + d.personas, 0);
  return (
    <div className="flex flex-wrap items-center justify-center gap-6">
      <div className="relative h-[190px] w-[190px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={datos}
              dataKey="personas"
              nameKey="etiqueta"
              innerRadius={62}
              outerRadius={88}
              paddingAngle={3}
              strokeWidth={0}
              isAnimationActive={false}
            >
              {datos.map((d, i) => (
                <Cell key={d.etiqueta} fill={COLORES[i % COLORES.length]} />
              ))}
            </Pie>
            <Tooltip {...tooltipProps} formatter={(valor) => [nf.format(Number(valor)), "Personas"]} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="font-display text-2xl font-extrabold tabular-nums text-foreground">{nf.format(total)}</p>
            <p className="text-[11px] text-muted-foreground">personas</p>
          </div>
        </div>
      </div>
      <ul className="space-y-2">
        {datos.map((d, i) => (
          <li key={d.etiqueta} className="flex items-center gap-2 text-[13px]">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORES[i % COLORES.length] }} />
            <span className="text-foreground">{d.etiqueta}</span>
            <span className="tabular-nums text-muted-foreground">
              {nf.format(d.personas)} · {total > 0 ? Math.round((d.personas / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Cohortes por mes de inscripción: qué % de cada camada ya terminó. */
export function Cohortes({ datos }: { datos: { mes: string; total: number; completadas: number }[] }) {
  if (datos.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Sin inscripciones en los últimos meses.</p>;
  }
  return (
    <div className="space-y-2.5">
      {datos.map((c) => {
        const pct = c.total > 0 ? Math.round((c.completadas / c.total) * 100) : 0;
        return (
          <div key={c.mes} className="flex items-center gap-3">
            <span className="w-16 shrink-0 text-[12px] font-semibold capitalize text-foreground">{fmtMes(c.mes)}</span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[color-mix(in_oklch,var(--muted-foreground)_14%,transparent)]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[var(--primary)] to-[var(--accent)]"
                style={{ width: `${Math.max(pct, 2)}%` }}
              />
            </div>
            <span className="w-28 shrink-0 text-right text-[12px] tabular-nums text-muted-foreground">
              {pct}% · {nf.format(c.completadas)}/{nf.format(c.total)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
