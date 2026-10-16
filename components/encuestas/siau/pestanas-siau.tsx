"use client";

import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export type PestanaSiau = { id: string; etiqueta: string; icono: ReactNode; conteo?: number; contenido: ReactNode };

/**
 * Pestañas de análisis del centro SIAU: un pozo con la pastilla en relieve
 * que se desliza (layoutId) y el contenido que se funde al cambiar. El
 * contenido llega ya pintado desde el servidor. Teclado: flechas, Inicio
 * y Fin, como un tablist WAI-ARIA. Con movimiento reducido (MotionConfig
 * "user") la pastilla no se desliza y el cambio es solo de opacidad.
 */
export function PestanasSiau({ pestanas, inicial }: { pestanas: PestanaSiau[]; inicial?: string }) {
  const [activa, setActiva] = useState(inicial ?? pestanas[0]?.id);
  const base = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const actual = pestanas.find((p) => p.id === activa) ?? pestanas[0];

  function teclado(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const n = pestanas.length;
    const destino = e.key === "ArrowRight" ? (i + 1) % n : e.key === "ArrowLeft" ? (i - 1 + n) % n : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : null;
    if (destino === null) return;
    e.preventDefault();
    setActiva(pestanas[destino].id);
    refs.current[destino]?.focus();
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="space-y-4">
        <div className="siau-pestanas" role="tablist" aria-label="Análisis del periodo">
          {pestanas.map((p, i) => {
            const sel = p.id === actual.id;
            return (
              <button
                key={p.id}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`${base}-tab-${p.id}`}
                aria-selected={sel}
                aria-controls={`${base}-panel-${p.id}`}
                tabIndex={sel ? 0 : -1}
                className="siau-pestana"
                onClick={() => setActiva(p.id)}
                onKeyDown={(e) => teclado(e, i)}
              >
                {sel && <motion.span layoutId={`${base}-pastilla`} className="siau-pastilla" transition={{ type: "spring", stiffness: 420, damping: 36 }} />}
                {p.icono}
                {p.etiqueta}
                {p.conteo !== undefined && <span className="conteo">{p.conteo}</span>}
              </button>
            );
          })}
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={actual.id}
            role="tabpanel"
            id={`${base}-panel-${actual.id}`}
            aria-labelledby={`${base}-tab-${actual.id}`}
            tabIndex={0}
            className="outline-none"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            {actual.contenido}
          </motion.div>
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
