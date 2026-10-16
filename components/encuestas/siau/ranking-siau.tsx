import type { CSSProperties } from "react";
import { pct, pp, semDe } from "@/components/encuestas/siau/semaforo";

export type FilaRanking = { nombre: string; valor: number | null; n: number; puntaje?: number | null };

/**
 * Ranking como lista ordenada: posición, nombre, pista hundida con el
 * relleno pleno del semáforo y la marca del promedio de referencia, la
 * cifra y la diferencia frente a esa referencia. Sin estado: se pinta en
 * el servidor.
 */
export function RankingSiau({ filas, referencia, unidad = "encuestas", etiquetaReferencia = "promedio" }: { filas: FilaRanking[]; referencia: number | null; unidad?: string; etiquetaReferencia?: string }) {
  const orden = [...filas].sort((a, b) => (b.valor ?? -1) - (a.valor ?? -1));
  if (orden.length === 0) return <p className="py-6 text-center text-[13px] text-muted-foreground">Sin datos en el periodo.</p>;
  return (
    <div>
      <div className="siau-rank-cabeza siau-mono" aria-hidden="true">
        <span>#</span>
        <span>Nombre</span>
        <span>Adherencia{referencia !== null ? ` · marca = ${etiquetaReferencia} ${referencia}%` : ""}</span>
        <span>%</span>
        <span>vs {etiquetaReferencia}</span>
      </div>
      <ol className="mt-1.5 space-y-0.5">
        {orden.map((f, i) => {
          const sem = semDe(f.valor);
          const dif = f.valor !== null && referencia !== null ? Math.round((f.valor - referencia) * 10) / 10 : null;
          return (
            <li key={f.nombre} className="siau-rank-fila" data-siau-sem={sem} style={{ ["--i" as string]: i } as CSSProperties}>
              <span className="siau-rank-pos">{i + 1}</span>
              <span className="siau-rank-nombre" title={f.nombre}>
                <span>{f.nombre}</span>
                <small>
                  {f.n} {unidad}
                  {f.puntaje != null ? ` · puntaje ${f.puntaje}%` : ""}
                </small>
              </span>
              <span className="siau-pista" role="img" aria-label={`${f.nombre}: ${pct(f.valor)}`}>
                {f.valor !== null && <span style={{ width: `calc(${Math.max(0, Math.min(100, f.valor))}% - 0.24rem)` }} />}
                {referencia !== null && <i style={{ left: `${referencia}%` }} />}
              </span>
              <span className="siau-rank-valor">{pct(f.valor)}</span>
              <span className={`siau-rank-dato siau-rank-extra ${dif === null || dif === 0 ? "" : dif > 0 ? "siau-dif-pos" : "siau-dif-neg"}`}>{pp(dif)}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
