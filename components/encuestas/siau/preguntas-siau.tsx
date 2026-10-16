import type { CSSProperties } from "react";
import { ChevronDown } from "lucide-react";
import type { MetricaPregunta } from "@/lib/encuestas/metrics";
import type { TonoOpcion } from "@/lib/encuestas/tipos";
import { COLOR_TONO, pct, pp, semDe } from "@/components/encuestas/siau/semaforo";

export const ESCALA_CARITAS: { tono: TonoOpcion; etiqueta: string }[] = [
  { tono: "exc", etiqueta: "Excelente / Muy buena / Sí" },
  { tono: "bue", etiqueta: "Bueno / Buena" },
  { tono: "reg", etiqueta: "Regular" },
  { tono: "mal", etiqueta: "Malo / Mala" },
  { tono: "muymal", etiqueta: "Muy malo / No" },
  { tono: "na", etiqueta: "No aplica" },
];

export function LeyendaCaritas() {
  return (
    <ul className="siau-leyenda" aria-label="Escala de respuestas">
      {ESCALA_CARITAS.map((t) => (
        <li key={t.tono}>
          <i style={{ background: COLOR_TONO[t.tono] }} />
          {t.etiqueta}
        </li>
      ))}
    </ul>
  );
}

/** Barra 100 % apilada con la distribución de respuestas de una pregunta. */
export function DistribucionCaritas({ pregunta }: { pregunta: MetricaPregunta }) {
  return (
    <div className="siau-dist" role="img" aria-label={pregunta.distribucion.map((d) => `${d.texto} ${d.pct}%`).join(", ")}>
      {pregunta.distribucion
        .filter((d) => d.n > 0)
        .map((d) => (
          <span key={d.opcionId} style={{ width: `${d.pct}%`, background: COLOR_TONO[d.tono ?? "na"] }} title={`${d.texto}: ${d.n} (${d.pct}%)`} />
        ))}
    </div>
  );
}

/**
 * Preguntas como lista densa: sello, enunciado con su distribución, n,
 * variación y la adherencia con el color del semáforo. Cada fila se
 * despliega (details) para ver el conteo por opción.
 */
export function ListaPreguntasSiau({ preguntas, variaciones }: { preguntas: MetricaPregunta[]; variaciones: Record<string, number | null> }) {
  return (
    <div>
      <div className="hidden grid-cols-[2.6rem_minmax(0,1fr)_4.2rem_5.6rem_1rem] gap-[0.9rem] px-[0.8rem] pb-2 md:grid" aria-hidden="true">
        <span className="siau-mono">#</span>
        <span className="siau-mono">Pregunta · distribución</span>
        <span className="siau-mono text-right">n</span>
        <span className="siau-mono text-right">Adherencia</span>
        <span />
      </div>
      <div className="space-y-1">
        {preguntas.map((p, i) => {
          const sem = semDe(p.adherencia);
          const v = variaciones[p.clave] ?? null;
          return (
            <details key={p.clave} className="siau-preg" style={{ ["--i" as string]: i } as CSSProperties}>
              <summary>
                <span className="siau-sello">P{p.numero}</span>
                <span className="siau-preg-texto">
                  <span className="siau-preg-enunciado" title={p.enunciado}>{p.enunciado}</span>
                  <DistribucionCaritas pregunta={p} />
                </span>
                <span className="siau-preg-n text-right">
                  <b className="block font-mono text-[13px] font-semibold text-foreground">{p.validas}</b>
                  <span className="siau-mono !text-[0.52rem]">válidas</span>
                </span>
                <span className="siau-preg-valor" data-siau-sem={sem}>
                  <b>{pct(p.adherencia)}</b>
                  <span className={v === null || v === 0 ? undefined : v > 0 ? "siau-dif-pos" : "siau-dif-neg"}>{v === null ? "sin previo" : pp(v)}</span>
                </span>
                <ChevronDown aria-hidden="true" />
              </summary>
              <div className="siau-preg-cuerpo">
                <ul className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-[12px] sm:grid-cols-2 xl:grid-cols-3">
                  {p.distribucion.map((d) => (
                    <li key={d.opcionId} className="flex min-w-0 items-center gap-2">
                      <i className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: COLOR_TONO[d.tono ?? "na"] }} />
                      <span className="truncate text-muted-foreground" title={d.texto}>
                        {d.texto}
                      </span>
                      <span className="ml-auto shrink-0 font-mono tabular-nums text-muted-foreground">
                        <b className="font-semibold text-foreground">{d.n}</b> · {d.pct}%
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="siau-mono mt-2.5 !normal-case !tracking-normal">
                  {p.favorables} favorables de {p.validas} válidas · puntaje {pct(p.puntaje)} · {p.n} respuestas
                </p>
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}

/** Mejores o peores preguntas, en una lista corta con pista de semáforo. */
export function TopPreguntas({ preguntas }: { preguntas: MetricaPregunta[] }) {
  if (preguntas.length === 0) return <p className="py-3 text-[12.5px] text-muted-foreground">Sin datos.</p>;
  return (
    <ul className="mt-3 space-y-3">
      {preguntas.map((p, i) => {
        const sem = semDe(p.adherencia);
        return (
          <li key={p.clave} data-siau-sem={sem} style={{ ["--i" as string]: i } as CSSProperties}>
            <div className="flex items-center gap-2.5">
              <span className="siau-sello w-10 shrink-0">P{p.numero}</span>
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-foreground" title={p.enunciado}>
                {p.enunciado}
              </span>
              <b className="shrink-0 font-mono text-[13px] font-semibold" style={{ color: "var(--sem-texto)" }}>
                {pct(p.adherencia)}
              </b>
            </div>
            <span className="siau-pista siau-pista-fina mt-2 ml-[3.25rem] block">
              {p.adherencia !== null && <span style={{ width: `calc(${p.adherencia}% - 0.24rem)` }} />}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
