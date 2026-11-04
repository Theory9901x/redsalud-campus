"use client";

/**
 * SCROLL MORPH HERO (adaptado de 21st.dev "scroll-morph-hero").
 *
 * Tarjetas que entran dispersas, se alinean, forman un círculo y, con la
 * rueda o el gesto táctil, se abren en un arco con el contenido encima.
 *
 * Cambios frente al original:
 * - Las tarjetas y los textos llegan por props (el original traía 20 fotos
 *   de stock fijas): aquí cada tarjeta es un nodo React cualquiera.
 * - Las posiciones "dispersas" son pseudoaleatorias DETERMINISTAS por índice:
 *   con Math.random() el servidor y el navegador pintaban estilos distintos
 *   y React marcaba error de hidratación.
 * - Línea, círculo y arco escalan con el número de tarjetas y el ancho
 *   disponible, para que 50+ tarjetas no se salgan de pantalla.
 * - Respeta "reducir movimiento": va directo al arco, sin coreografía.
 * - El contenido del arco acepta hijos interactivos (botones).
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";

export type AnimationPhase = "scatter" | "line" | "circle";

type Target = { x: number; y: number; rotation: number; scale: number; opacity: number };

const lerp = (a: number, b: number, t: number) => a * (1 - t) + b * t;
/** Pseudoaleatorio estable en [0, 1) a partir de un entero. */
const azar = (n: number) => {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

function FlipCard({ front, back, target, width, height }: { front: React.ReactNode; back?: React.ReactNode; target: Target; width: number; height: number }) {
  return (
    <motion.div
      animate={{ x: target.x, y: target.y, rotate: target.rotation, scale: target.scale, opacity: target.opacity }}
      transition={{ type: "spring", stiffness: 40, damping: 15 }}
      style={{ position: "absolute", width, height, transformStyle: "preserve-3d", perspective: "1000px" }}
      className="group"
    >
      <motion.div
        className="relative h-full w-full"
        style={{ transformStyle: "preserve-3d" }}
        transition={{ duration: 0.6, type: "spring", stiffness: 260, damping: 20 }}
        whileHover={back ? { rotateY: 180 } : undefined}
      >
        <div className="absolute inset-0 h-full w-full" style={{ backfaceVisibility: "hidden" }}>
          {front}
        </div>
        {back && (
          <div className="absolute inset-0 h-full w-full" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
            {back}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

const MAX_SCROLL = 3000;

export default function ScrollMorphHero({
  cards,
  cardWidth = 60,
  cardHeight = 85,
  introTitle,
  introHint = "Desplaza para continuar",
  arcContent,
  className = "",
  onArcReady,
}: {
  cards: { key: string; front: React.ReactNode; back?: React.ReactNode }[];
  cardWidth?: number;
  cardHeight?: number;
  introTitle: React.ReactNode;
  introHint?: React.ReactNode;
  /** Lo que aparece sobre el arco cuando termina de formarse. */
  arcContent?: React.ReactNode;
  className?: string;
  /** Se llama una vez, cuando el arco ya está formado. */
  onArcReady?: () => void;
}) {
  const total = cards.length;
  const reducir = useReducedMotion();
  const [phase, setPhase] = useState<AnimationPhase>(reducir ? "circle" : "scatter");
  const [size, setSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Tamaño del contenedor.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setSize({ width: e.contentRect.width, height: e.contentRect.height });
    });
    ro.observe(el);
    setSize({ width: el.offsetWidth, height: el.offsetHeight });
    return () => ro.disconnect();
  }, []);

  // Scroll virtual: rueda, gesto táctil y teclado.
  const virtualScroll = useMotionValue(reducir ? 600 : 0);
  const scrollRef = useRef(reducir ? 600 : 0);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const mover = (delta: number) => {
      scrollRef.current = Math.min(Math.max(scrollRef.current + delta, 0), MAX_SCROLL);
      virtualScroll.set(scrollRef.current);
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      mover(e.deltaY);
    };
    let y0 = 0;
    const onTouchStart = (e: TouchEvent) => {
      y0 = e.touches[0].clientY;
    };
    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0].clientY;
      mover(y0 - y);
      y0 = y;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "PageDown") mover(200);
      if (e.key === "ArrowUp" || e.key === "PageUp") mover(-200);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("keydown", onKey);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("keydown", onKey);
    };
  }, [virtualScroll]);

  const morphProgress = useTransform(virtualScroll, [0, 600], [0, 1]);
  const smoothMorph = useSpring(morphProgress, { stiffness: 40, damping: 20 });
  const scrollRotate = useTransform(virtualScroll, [600, MAX_SCROLL], [0, 360]);
  const smoothScrollRotate = useSpring(scrollRotate, { stiffness: 40, damping: 20 });

  // Paralaje con el mouse.
  const mouseX = useMotionValue(0);
  const smoothMouseX = useSpring(mouseX, { stiffness: 30, damping: 20 });
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      mouseX.set((((e.clientX - r.left) / r.width) * 2 - 1) * 60);
    };
    el.addEventListener("mousemove", onMove);
    return () => el.removeEventListener("mousemove", onMove);
  }, [mouseX]);

  // Coreografía de entrada.
  useEffect(() => {
    if (reducir) return;
    const t1 = setTimeout(() => setPhase("line"), 500);
    const t2 = setTimeout(() => setPhase("circle"), 2300);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [reducir]);

  const scatter = useMemo(
    () =>
      cards.map((_, i) => ({
        x: (azar(i) - 0.5) * 1500,
        y: (azar(i + 101) - 0.5) * 1000,
        rotation: (azar(i + 202) - 0.5) * 180,
        scale: 0.6,
        opacity: 0,
      })),
    [cards],
  );

  const [morph, setMorph] = useState(reducir ? 1 : 0);
  const [rotate, setRotate] = useState(0);
  const [parallax, setParallax] = useState(0);
  const avisado = useRef(false);
  useEffect(() => {
    const a = smoothMorph.on("change", (v) => {
      setMorph(v);
      if (v > 0.95 && !avisado.current) {
        avisado.current = true;
        onArcReady?.();
      }
    });
    const b = smoothScrollRotate.on("change", setRotate);
    const c = smoothMouseX.on("change", setParallax);
    return () => {
      a();
      b();
      c();
    };
  }, [smoothMorph, smoothScrollRotate, smoothMouseX, onArcReady]);

  const contentOpacity = useTransform(smoothMorph, [0.8, 1], [0, 1]);
  const contentY = useTransform(smoothMorph, [0.8, 1], [20, 0]);
  const [arcoListo, setArcoListo] = useState(reducir);
  useEffect(() => smoothMorph.on("change", (v) => setArcoListo(v > 0.85)), [smoothMorph]);

  const objetivo = (i: number): Target => {
    if (phase === "scatter") return scatter[i];
    if (phase === "line") {
      const espacio = Math.min(cardWidth + 10, (size.width * 0.92) / Math.max(total, 1));
      return { x: i * espacio - (total * espacio) / 2 + espacio / 2, y: 0, rotation: 0, scale: Math.min(1, espacio / (cardWidth + 10)), opacity: 1 };
    }
    const movil = size.width < 768;
    const minDim = Math.min(size.width, size.height);
    const radioCirculo = Math.min(minDim * 0.35, 350);
    const angCirculo = (i / total) * 360;
    const radC = (angCirculo * Math.PI) / 180;
    const circulo = { x: Math.cos(radC) * radioCirculo, y: Math.sin(radC) * radioCirculo, rotation: angCirculo + 90 };

    const base = Math.min(size.width, size.height * 1.5);
    const radioArco = base * (movil ? 1.4 : 1.1);
    const cimaY = size.height * (movil ? 0.35 : 0.25);
    const centroY = cimaY + radioArco;
    const abertura = movil ? 100 : 130;
    const inicio = -90 - abertura / 2;
    const paso = abertura / Math.max(total - 1, 1);
    // Escala del arco: que las tarjetas casi se toquen, sin pasar de 1.8.
    const largoPorTarjeta = (radioArco * ((abertura * Math.PI) / 180)) / Math.max(total, 1);
    const escalaArco = Math.max(0.8, Math.min(movil ? 1.4 : 1.8, (largoPorTarjeta * 1.15) / cardWidth));
    const progreso = Math.min(Math.max(rotate / 360, 0), 1);
    const ang = inicio + i * paso - progreso * abertura * 0.8;
    const rad = (ang * Math.PI) / 180;
    const arco = { x: Math.cos(rad) * radioArco + parallax, y: Math.sin(rad) * radioArco + centroY, rotation: ang + 90 };
    return {
      x: lerp(circulo.x, arco.x, morph),
      y: lerp(circulo.y, arco.y, morph),
      rotation: lerp(circulo.rotation, arco.rotation, morph),
      scale: lerp(1, escalaArco, morph),
      opacity: 1,
    };
  };

  return (
    <div ref={containerRef} className={`relative h-full w-full overflow-hidden ${className}`}>
      <div className="flex h-full w-full flex-col items-center justify-center">
        <div className="pointer-events-none absolute top-1/2 z-0 flex -translate-y-1/2 flex-col items-center justify-center px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
            animate={phase === "circle" && morph < 0.5 ? { opacity: 1 - morph * 2, y: 0, filter: "blur(0px)" } : { opacity: 0, filter: "blur(10px)" }}
            transition={{ duration: 1 }}
          >
            {introTitle}
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={phase === "circle" && morph < 0.5 ? { opacity: 0.6 - morph } : { opacity: 0 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="mt-5 text-[11px] font-bold uppercase tracking-[0.28em]"
          >
            {introHint}
          </motion.p>
        </div>

        <motion.div
          style={{ opacity: contentOpacity, y: contentY, pointerEvents: arcoListo ? "auto" : "none" }}
          className="absolute top-[9%] z-10 flex flex-col items-center justify-center px-4 text-center"
        >
          {arcContent}
        </motion.div>

        <div className="relative flex h-full w-full items-center justify-center">
          {cards.map((c, i) => (
            <FlipCard key={c.key} front={c.front} back={c.back} target={objetivo(i)} width={cardWidth} height={cardHeight} />
          ))}
        </div>
      </div>
    </div>
  );
}
