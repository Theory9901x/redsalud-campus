"use client";

import { useEffect, useRef } from "react";

type Punto = { x: number; y: number; vx: number; vy: number; r: number; verde: boolean };

/** Distancia (px) por debajo de la cual dos puntos se unen con una línea. */
const ALCANCE = 150;

/**
 * Fondo del panel de acceso: una constelación de puntos que derivan despacio
 * y se unen con líneas finas cuando se acercan. Se mueve siempre, pero lento:
 * acompaña, no distrae del formulario.
 *
 * - Se dibuja en un <canvas> que ocupa todo el panel (el padre debe ser
 *   `relative` y `overflow-hidden`).
 * - Se detiene con la pestaña oculta, y con «reducir movimiento» pinta un
 *   único cuadro fijo.
 * - Blanco y verde literales: el panel es el mismo en los dos temas.
 */
export function Constelacion() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const lienzo = ref.current;
    const ctx = lienzo?.getContext("2d");
    if (!lienzo || !ctx) return;

    const quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const verde = getComputedStyle(lienzo).getPropertyValue("--constelacion-verde").trim() || "#4ade80";
    let ancho = 0;
    let alto = 0;
    let puntos: Punto[] = [];
    let cuadro = 0;

    const sembrar = () => {
      const total = Math.min(110, Math.max(10, Math.round((ancho * alto) / 11000)));
      puntos = Array.from({ length: total }, (_, i) => {
        const angulo = Math.random() * Math.PI * 2;
        const paso = 0.12 + Math.random() * 0.22;
        return {
          x: Math.random() * ancho,
          y: Math.random() * alto,
          vx: Math.cos(angulo) * paso,
          vy: Math.sin(angulo) * paso,
          r: 1 + Math.random() * 1.6,
          verde: i % 7 === 0,
        };
      });
    };

    const ajustar = () => {
      const caja = lienzo.getBoundingClientRect();
      if (caja.width === 0 || caja.height === 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      ancho = caja.width;
      alto = caja.height;
      lienzo.width = Math.round(ancho * dpr);
      lienzo.height = Math.round(alto * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sembrar();
      if (quieto) pintar();
    };

    const pintar = () => {
      ctx.clearRect(0, 0, ancho, alto);
      ctx.lineWidth = 1;
      for (let i = 0; i < puntos.length; i++) {
        const a = puntos[i];
        for (let j = i + 1; j < puntos.length; j++) {
          const b = puntos[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > ALCANCE * ALCANCE) continue;
          ctx.globalAlpha = (1 - Math.sqrt(d2) / ALCANCE) * 0.32;
          ctx.strokeStyle = a.verde || b.verde ? verde : "#ffffff";
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
      for (const p of puntos) {
        ctx.globalAlpha = p.verde ? 0.95 : 0.7;
        ctx.fillStyle = p.verde ? verde : "#ffffff";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const avanzar = () => {
      for (const p of puntos) {
        p.x += p.vx;
        p.y += p.vy;
        // Sale por un lado y entra por el otro: el movimiento no se corta.
        if (p.x < -10) p.x = ancho + 10;
        else if (p.x > ancho + 10) p.x = -10;
        if (p.y < -10) p.y = alto + 10;
        else if (p.y > alto + 10) p.y = -10;
      }
      pintar();
      cuadro = requestAnimationFrame(avanzar);
    };

    const alCambiarVisibilidad = () => {
      cancelAnimationFrame(cuadro);
      if (!document.hidden && !quieto) cuadro = requestAnimationFrame(avanzar);
    };

    const observador = new ResizeObserver(ajustar);
    observador.observe(lienzo);
    ajustar();
    if (!quieto) cuadro = requestAnimationFrame(avanzar);
    document.addEventListener("visibilitychange", alCambiarVisibilidad);

    return () => {
      cancelAnimationFrame(cuadro);
      observador.disconnect();
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
    };
  }, []);

  return <canvas ref={ref} className="auth-constelacion" aria-hidden="true" />;
}
