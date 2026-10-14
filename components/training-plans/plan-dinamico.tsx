"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

const reducirMovimiento = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Cifra que cuenta hasta su valor al aparecer (telemetría que "carga").
 * El HTML del servidor trae el valor final -sin JS, o con movimiento
 * reducido, se ve el número real-; el conteo arranca antes del primer
 * pintado (useLayoutEffect), así que no hay parpadeo del valor final.
 */
export function Cifra({ valor, duracion = 900, sufijo = "" }: { valor: number; duracion?: number; sufijo?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  // Anima el TEXTO del nodo, no estado de React: cero renderizados extra
  // durante el conteo y sin setState dentro del efecto.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || reducirMovimiento() || valor === 0) return;
    let raf = 0;
    const inicio = performance.now();
    el.textContent = `0${sufijo}`;
    const paso = (t: number) => {
      const p = Math.min(1, (t - inicio) / duracion);
      const facil = 1 - Math.pow(1 - p, 4); // ease-out, como la curva de firma
      el.textContent = `${Math.round(valor * facil)}${sufijo}`;
      if (p < 1) raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => {
      cancelAnimationFrame(raf);
      el.textContent = `${valor}${sufijo}`;
    };
  }, [valor, duracion, sufijo]);
  return (
    // key = valor: como el efecto reescribe el texto del nodo, un valor
    // nuevo remonta el elemento en vez de que React toque un texto ajeno.
    <span key={`${valor}${sufijo}`} ref={ref} className="tabular-nums">
      {`${valor}${sufijo}`}
    </span>
  );
}

/**
 * Contenedor que alimenta el FOCO QUE SIGUE AL CURSOR de las tarjetas
 * (.plan-instancia::after usa --mx/--my). Un solo listener para toda la
 * grilla en vez de uno por tarjeta; en táctil no hace nada.
 */
export function FocoCursor({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      className={className}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse") return;
        const tarjeta = (e.target as HTMLElement).closest<HTMLElement>(".plan-instancia");
        if (!tarjeta || !ref.current?.contains(tarjeta)) return;
        const r = tarjeta.getBoundingClientRect();
        tarjeta.style.setProperty("--mx", `${e.clientX - r.left}px`);
        tarjeta.style.setProperty("--my", `${e.clientY - r.top}px`);
      }}
    >
      {children}
    </div>
  );
}
