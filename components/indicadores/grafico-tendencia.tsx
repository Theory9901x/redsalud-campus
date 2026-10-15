"use client";

import { Area, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Medicion } from "@/lib/indicadores-gestion";
import { UMBRAL_AMARILLO, UMBRAL_VERDE } from "@/lib/semaforo-indicadores";
import { ROMANO, formatearValor, type CodigoIndicador } from "@/components/indicadores/catalogo";
import { COLOR_SEMAFORO } from "@/components/indicadores/graficos-svg";

type Punto = { nombre: string; valor: number | null; sem: Medicion["sem"]; periodo: Medicion["periodo"] };

/**
 * TENDENCIA por trimestre del indicador: una sola serie, bandas tenues de
 * los tres rangos del semáforo como contexto y la meta (85) como línea
 * discontinua. Los puntos toman el color de su semáforo; un trimestre sin
 * dato deja hueco, no se interpola. Contenido, sin leyenda: el título de la
 * pestaña ya dice qué se mide.
 */
export function GraficoTendencia({ codigo, trimestres, actual, anio }: { codigo: CodigoIndicador; trimestres: Medicion[]; actual: number; anio: number }) {
  const data: Punto[] = trimestres.map((t) => ({ nombre: `T${ROMANO[(t.trimestre ?? 1) - 1]}`, valor: t.valor, sem: t.sem, periodo: t.periodo }));
  const presentes = data.map((d) => d.valor).filter((v): v is number => v !== null);
  const min = Math.min(0, ...presentes);
  const max = Math.max(100, ...presentes);
  const techo = Math.ceil(max / 10) * 10;
  const piso = Math.floor(min / 10) * 10;
  const unidad = codigo === "PIC-ADH-01" ? "pp" : "%";

  // Sin ningún dato en el año no hay tendencia que dibujar: recharts pinta
  // un lienzo vacío sin ejes ni bandas, que parece un error. Se dice claro.
  if (presentes.length === 0) {
    return (
      <div className="ind-vacio">
        <div>
          <b>Todavía no hay mediciones con dato en {anio}.</b>
          <p>
            {codigo === "PIC-ADH-01"
              ? "La adherencia aparece en cuanto alguien completa presaber y postsaber en una capacitación: preliminar mientras la jornada siga abierta, definitiva al cerrarla. Hasta entonces no hay línea base."
              : "El indicador se poblará solo a medida que la plataforma registre datos del periodo."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="ind-grafico" style={{ width: "100%", height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 12, right: 18, bottom: 4, left: -8 }}>
          <defs>
            <linearGradient id={`ind-area-${codigo}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--ind-a)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--ind-a)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <ReferenceArea y1={UMBRAL_VERDE} y2={techo} fill="var(--success)" fillOpacity={0.06} ifOverflow="hidden" />
          <ReferenceArea y1={UMBRAL_AMARILLO} y2={UMBRAL_VERDE} fill="var(--warning)" fillOpacity={0.07} ifOverflow="hidden" />
          <ReferenceArea y1={piso} y2={UMBRAL_AMARILLO} fill="var(--destructive)" fillOpacity={0.04} ifOverflow="hidden" />
          <XAxis dataKey="nombre" tick={{ fontSize: 11, fill: "var(--muted-foreground)", fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} />
          <YAxis domain={[piso, techo]} tick={{ fontSize: 11, fill: "var(--muted-foreground)", fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}`} width={40} />
          <ReferenceLine
            y={UMBRAL_VERDE}
            stroke="var(--success)"
            strokeDasharray="4 4"
            strokeWidth={1.2}
            label={{ value: `Meta ${UMBRAL_VERDE} ${unidad}`, position: "insideTopRight", fontSize: 10, fill: "var(--success)", fontFamily: "var(--font-mono)" }}
          />
          <Tooltip
            cursor={{ stroke: "color-mix(in oklch, var(--foreground) 18%, transparent)", strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              const p = active && payload && payload.length ? (payload[0].payload as Punto) : null;
              if (!p) return null;
              return (
                <div className="ind-tooltip">
                  <span className="mono-label">Trimestre {p.nombre.slice(1)}</span>
                  <b style={{ color: COLOR_SEMAFORO[p.sem] }}>{formatearValor(codigo, p.valor)}</b>
                  <small>{p.periodo === "futuro" ? "Sin iniciar" : p.periodo === "en-curso" ? "En curso · se mueve en tiempo real" : "Periodo cerrado"}</small>
                </div>
              );
            }}
          />
          <Area type="monotone" dataKey="valor" stroke="none" fill={`url(#ind-area-${codigo})`} connectNulls={false} isAnimationActive={false} />
          <Line
            type="monotone"
            dataKey="valor"
            stroke="var(--ind-a)"
            strokeWidth={2.2}
            connectNulls={false}
            isAnimationActive={false}
            dot={(props: { cx?: number; cy?: number; payload?: Punto; index?: number }) => {
              const { cx, cy, payload, index } = props;
              if (cx === undefined || cy === undefined || !payload || payload.valor === null) return <g key={index} />;
              const vigente = (index ?? -1) + 1 === actual;
              return (
                <g key={index}>
                  {vigente && <circle cx={cx} cy={cy} r={9} fill={COLOR_SEMAFORO[payload.sem]} fillOpacity={0.18} />}
                  <circle cx={cx} cy={cy} r={vigente ? 5 : 4} fill={COLOR_SEMAFORO[payload.sem]} stroke="var(--card)" strokeWidth={2} />
                </g>
              );
            }}
            activeDot={{ r: 6, strokeWidth: 0 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
