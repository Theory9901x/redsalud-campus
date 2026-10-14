"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * AURORA WebGL de la cabecera del curso: un campo de luz con ruido fractal
 * deformado (domain warping) en los colores de marca, una retícula técnica
 * muy tenue y una leve paralaje con el cursor.
 *
 * Costo controlado, porque se ve en celulares de la red institucional:
 *  - Resolución interna reducida (≤ 1.25× y escala 0.75) y un solo pase.
 *  - Se PAUSA cuando la cabecera sale de pantalla o la pestaña se oculta.
 *  - Con "reducir movimiento" pinta un cuadro fijo y no anima.
 *  - Sin WebGL, el lienzo no se monta y queda el degradado CSS del padre.
 */
const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
uniform vec2 u_res;
uniform float u_t;
uniform vec2 u_mouse;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return v;
}

void main(){
  vec2 uv = gl_FragCoord.xy / u_res.xy;
  vec2 p = (gl_FragCoord.xy - 0.5 * u_res.xy) / u_res.y;
  p += (u_mouse - 0.5) * 0.08;
  float t = u_t * 0.045;

  // Domain warping: dos capas de fbm que se deforman entre sí.
  vec2 q = vec2(fbm(p * 1.6 + t), fbm(p * 1.6 - t + 4.3));
  vec2 r = vec2(fbm(p * 1.4 + 2.2 * q + vec2(1.7, 9.2) + t * 1.3), fbm(p * 1.4 + 2.2 * q + vec2(8.3, 2.8) - t));
  float f = fbm(p * 1.2 + 2.6 * r);

  vec3 navy  = vec3(0.035, 0.090, 0.165);
  vec3 deep  = vec3(0.055, 0.160, 0.290);
  vec3 cyan  = vec3(0.169, 0.651, 0.871);
  vec3 green = vec3(0.231, 0.710, 0.290);

  vec3 col = mix(navy, deep, smoothstep(0.10, 0.75, f));
  col = mix(col, cyan, smoothstep(0.42, 0.90, f) * 0.78 * (0.55 + 0.45 * r.x));
  col = mix(col, green, smoothstep(0.55, 0.95, q.y * f + 0.30) * 0.34);

  // Banda de aurora diagonal que respira.
  float banda = exp(-pow((p.y + 0.35 * p.x - 0.15 * sin(t * 6.0 + p.x * 2.0)) * 2.6, 2.0));
  col += cyan * banda * 0.22 * (0.5 + 0.5 * f);

  // Retícula técnica muy tenue, más visible hacia la derecha.
  vec2 g = abs(fract(gl_FragCoord.xy / 38.0) - 0.5);
  float linea = 1.0 - smoothstep(0.0, 0.035, min(g.x, g.y));
  col += vec3(0.6, 0.85, 1.0) * linea * 0.035 * smoothstep(0.2, 1.0, uv.x);

  // Viñeta y lado izquierdo más oscuro para el texto.
  col *= mix(0.80, 1.08, smoothstep(0.0, 0.70, uv.x));
  col *= 1.0 - 0.28 * length(uv - vec2(0.60, 0.5));

  gl_FragColor = vec4(col, 1.0);
}
`;

export function AuroraWebGL({ className }: { className?: string }) {
  const lienzo = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = lienzo.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { antialias: false, premultipliedAlpha: false, powerPreference: "low-power" });
    if (!gl) {
      canvas.style.display = "none";
      return;
    }

    const compilar = (tipo: number, fuente: string) => {
      const sh = gl.createShader(tipo)!;
      gl.shaderSource(sh, fuente);
      gl.compileShader(sh);
      return gl.getShaderParameter(sh, gl.COMPILE_STATUS) ? sh : null;
    };
    const vs = compilar(gl.VERTEX_SHADER, VERT);
    const fs = compilar(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) {
      canvas.style.display = "none";
      return;
    }
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      canvas.style.display = "none";
      return;
    }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, "u_res");
    const uT = gl.getUniformLocation(prog, "u_t");
    const uMouse = gl.getUniformLocation(prog, "u_mouse");

    const quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const escala = Math.min(window.devicePixelRatio || 1, 1.25) * 0.75;
    const raton = { x: 0.5, y: 0.5, ox: 0.5, oy: 0.5 };

    const ajustar = () => {
      const w = Math.max(1, Math.floor(canvas.clientWidth * escala));
      const h = Math.max(1, Math.floor(canvas.clientHeight * escala));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
      gl.uniform2f(uRes, w, h);
    };

    let raf = 0;
    let visible = true;
    const inicio = performance.now();
    const pintar = (ahora: number) => {
      ajustar();
      raton.ox += (raton.x - raton.ox) * 0.04;
      raton.oy += (raton.y - raton.oy) * 0.04;
      gl.uniform1f(uT, quieto ? 12.0 : (ahora - inicio) / 1000);
      gl.uniform2f(uMouse, raton.ox, raton.oy);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!quieto && visible && !document.hidden) raf = requestAnimationFrame(pintar);
    };
    const reanudar = () => {
      cancelAnimationFrame(raf);
      if (!quieto && visible && !document.hidden) raf = requestAnimationFrame(pintar);
    };

    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      reanudar();
    });
    io.observe(canvas);
    const alMover = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      raton.x = (e.clientX - r.left) / r.width;
      raton.y = 1 - (e.clientY - r.top) / r.height;
    };
    window.addEventListener("pointermove", alMover, { passive: true });
    document.addEventListener("visibilitychange", reanudar);
    const ro = new ResizeObserver(() => quieto && pintar(performance.now()));
    ro.observe(canvas);

    pintar(performance.now());

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("pointermove", alMover);
      document.removeEventListener("visibilitychange", reanudar);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  return <canvas ref={lienzo} aria-hidden="true" className={cn("pointer-events-none absolute inset-0 h-full w-full", className)} />;
}
