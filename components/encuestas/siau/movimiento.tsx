"use client";

import { animate } from "framer-motion";
import { Download } from "lucide-react";
import { useLayoutEffect, useRef, type ReactNode } from "react";

function reducirMovimiento() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function formatear(v: number, decimales: number, signo: boolean, sufijo: string) {
  const texto = v.toFixed(decimales);
  return `${signo && v > 0 ? "+" : ""}${texto}${sufijo}`;
}

/**
 * Cifra que cuenta desde cero al montar (framer-motion). El servidor pinta
 * el valor final -sin parpadeo ni desajuste de hidratación- y el conteo
 * reescribe solo el texto del nodo; con movimiento reducido no anima.
 */
export function CifraSiau({ valor, sufijo = "", signo = false, vacio = "—" }: { valor: number | null; sufijo?: string; signo?: boolean; vacio?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const decimales = valor !== null && !Number.isInteger(valor) ? 1 : 0;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || valor === null || valor === 0 || reducirMovimiento()) return;
    el.textContent = formatear(0, decimales, signo, sufijo);
    const control = animate(0, valor, {
      duration: 1.1,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        el.textContent = formatear(v, decimales, signo, sufijo);
      },
    });
    return () => {
      control.stop();
      el.textContent = formatear(valor, decimales, signo, sufijo);
    };
  }, [valor, decimales, signo, sufijo]);

  if (valor === null) return <span>{vacio}</span>;
  return (
    <span key={`${valor}${sufijo}`} ref={ref} className="tabular-nums">
      {formatear(valor, decimales, signo, sufijo)}
    </span>
  );
}

/** Lleva a la estación de exportación, la enfoca y la ilumina un instante. */
export function enfocarExportacion() {
  const el = document.getElementById("exportar");
  if (!el) return;
  el.scrollIntoView({ behavior: reducirMovimiento() ? "auto" : "smooth", block: "start" });
  el.focus({ preventScroll: true });
  el.dataset.foco = "false";
  // Reinicia la animación aunque se pulse dos veces seguidas.
  void el.offsetWidth;
  el.dataset.foco = "true";
  window.setTimeout(() => {
    if (el.dataset.foco === "true") el.dataset.foco = "false";
  }, 1900);
  if (window.location.hash !== "#exportar") window.history.replaceState(null, "", "#exportar");
}

export function BotonExportar({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <a
      href="#exportar"
      className={className ?? "siau-boton siau-boton-primario"}
      onClick={(e) => {
        e.preventDefault();
        enfocarExportacion();
      }}
    >
      <Download aria-hidden="true" />
      {children ?? "Exportar"}
    </a>
  );
}
