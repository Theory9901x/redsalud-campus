"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { GanadoresIps } from "@/lib/galardones/consultas";
import { nombreCentro } from "@/lib/galardones/ips";
import { valorInfo } from "@/lib/galardones/valores";

/** Cada cuánto pasa al siguiente centro. */
const CADA_CENTRO = 7000;
const EASE = [0.16, 1, 0.3, 1] as const;
const HORA = new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit", second: "2-digit", timeZone: "America/Bogota" });

/**
 * VAN PUNTEANDO: quién va adelante en cada centro y valor, mientras la
 * convocatoria sigue abierta. Rota por los centros que ya tienen
 * postulaciones. Los datos llegan en vivo desde la ceremonia
 * (useGanadoresEnVivo), sin reiniciar la escena 3D.
 * Usa la misma regla que la ceremonia (tres personas distintas por centro;
 * solo suman las postulaciones válidas).
 */
export function Punteando({ datos, actualizado }: { datos: GanadoresIps[]; actualizado: Date }) {
  const [i, setI] = useState(0);
  const [pausa, setPausa] = useState(false);

  const activos = datos.filter((c) => c.votantes > 0);
  const n = activos.length;
  const idx = n ? ((i % n) + n) % n : 0;
  const centro = activos[idx];

  useEffect(() => {
    if (pausa || n < 2) return;
    const t = setInterval(() => setI((x) => x + 1), CADA_CENTRO);
    return () => clearInterval(t);
  }, [pausa, n]);

  return (
    <motion.aside
      className="cer-punteo"
      aria-label="Van punteando"
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 1.1, ease: EASE, delay: 1.4 }}
      onMouseEnter={() => setPausa(true)}
      onMouseLeave={() => setPausa(false)}
    >
      <header>
        <span className="vivo">
          <i aria-hidden="true" />
          En vivo
        </span>
        <b>Van punteando</b>
        {n > 1 && (
          <span className="paso">
            {idx + 1}/{n}
          </span>
        )}
      </header>

      {!centro ? (
        <p className="vacio">Aún no hay postulaciones válidas. En cuanto lleguen, aquí se verá quién va adelante en cada centro.</p>
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={centro.ips} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.45, ease: EASE }}>
            <h3>{nombreCentro(centro.ips)}</h3>
            <small className="meta">
              {centro.votantes} {centro.votantes === 1 ? "persona postuló" : "personas postularon"}
            </small>
            <ol>
              {centro.ganadores.map((g) => {
                const info = valorInfo(g.valor);
                const p = g.personas[0];
                return (
                  <li key={g.valor} style={{ ["--c-h" as string]: info.matiz }}>
                    <span className="valor">{info.nombre}</span>
                    {p ? (
                      <>
                        <b>{g.personas.map((x) => x.nombre).join(" · ")}</b>
                        <span className="votos">
                          {g.empate ? "Empate · " : ""}
                          {p.votos} {p.votos === 1 ? "postulación" : "postulaciones"}
                        </span>
                      </>
                    ) : (
                      <b className="nadie">Sin postulaciones aún</b>
                    )}
                  </li>
                );
              })}
            </ol>
          </motion.div>
        </AnimatePresence>
      )}

      <footer>
        {n > 1 ? (
          <div className="nav">
            <button type="button" onClick={() => setI(idx - 1)} aria-label="Centro anterior">
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => setI(idx + 1)} aria-label="Centro siguiente">
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <span />
        )}
        <small>Actualizado {HORA.format(actualizado)}</small>
      </footer>
    </motion.aside>
  );
}
