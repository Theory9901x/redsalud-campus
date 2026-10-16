"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { pct, semDe } from "@/components/encuestas/siau/semaforo";

type FilaCruce = { valor: string; total: number; adherencia: number | null; porPregunta: Record<string, number | null> };
export type VariableCruce = { id: string; etiqueta: string; filas: FilaCruce[] };

/**
 * Cruces por variable como UN mapa de calor: se elige la variable (servicio,
 * sexo, EPS, sede) en un segmentado y la tabla muestra la adherencia general
 * y la de cada pregunta, con el tinte del semáforo institucional.
 */
export function CrucesSiau({ variables, preguntas }: { variables: VariableCruce[]; preguntas: { clave: string; numero: number | null }[] }) {
  const [id, setId] = useState(variables[0]?.id);
  const actual = variables.find((v) => v.id === id) ?? variables[0];
  if (!actual) return null;
  const filas = [...actual.filas].sort((a, b) => (b.adherencia ?? -1) - (a.adherencia ?? -1));

  return (
    <section className="siau-sup siau-tarjeta min-w-0">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="siau-h2">
            <i>05</i>Adherencia por variable
          </h2>
          <p className="siau-bajada">Cada fila es un valor de la variable; cada celda, la adherencia de esa pregunta para ese grupo.</p>
        </div>
        <div className="siau-segmento max-w-full overflow-x-auto" role="radiogroup" aria-label="Variable del cruce">
          {variables.map((v) => (
            <button key={v.id} type="button" role="radio" aria-checked={v.id === actual.id} data-activo={v.id === actual.id} onClick={() => setId(v.id)}>
              {v.id === actual.id && <motion.span layoutId="siau-cruce-variable" className="siau-pastilla" transition={{ type: "spring", stiffness: 420, damping: 36 }} />}
              {v.etiqueta}
              <span className="conteo">{v.filas.length}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="-mx-1 mt-4 overflow-x-auto px-1">
        <table className="siau-tabla" style={{ minWidth: 220 + preguntas.length * 74 }}>
          <thead>
            <tr>
              <th className="text-left">{actual.etiqueta}</th>
              <th className="num">n</th>
              <th className="centro">General</th>
              {preguntas.map((p) => (
                <th key={p.clave} className="centro">
                  P{p.numero}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.valor}>
                <td className="max-w-[240px] truncate font-semibold text-foreground" title={f.valor}>
                  {f.valor}
                </td>
                <td className="num text-muted-foreground">{f.total}</td>
                <td className="centro">
                  <span className="siau-celda siau-celda-solida" data-siau-sem={semDe(f.adherencia)}>
                    {pct(f.adherencia)}
                  </span>
                </td>
                {preguntas.map((p) => {
                  const v = f.porPregunta[p.clave] ?? null;
                  return (
                    <td key={p.clave} className="centro">
                      <span className="siau-celda" data-siau-sem={semDe(v)}>
                        {pct(v)}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
            {filas.length === 0 && (
              <tr>
                <td colSpan={3 + preguntas.length} className="py-8 text-center text-muted-foreground">
                  Sin datos para esta variable en el periodo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
