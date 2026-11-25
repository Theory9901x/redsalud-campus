"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { Constelacion } from "@/components/auth/constelacion";

/**
 * Fondo del panel de acceso en WebGL (sin librerías): dos capas en un mismo
 * <canvas>.
 *
 *  1. Aurora: un sombreador de pantalla completa con cintas de luz que fluyen
 *     en los colores de la marca, leídos de los tokens (--primary, el azul
 *     claro de RedSalud, que domina; --success y un fondo de --navy).
 *  2. Red en 3D: puntos que derivan dentro de un volumen que gira despacio,
 *     unidos por líneas cuando se acercan. Tienen profundidad (los cercanos
 *     son más grandes y brillantes) y la escena acompaña al puntero.
 *
 * Se detiene con la pestaña oculta o el panel sin tamaño, va a media
 * velocidad con «reducir movimiento», y si el equipo no tiene WebGL cae a la
 * constelación en 2D (components/auth/constelacion.tsx).
 */

const VERT_FONDO = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG_FONDO = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes;
uniform float uT;
uniform vec2 uPuntero;
uniform vec3 uAzul;   // --primary: el azul claro de RedSalud
uniform vec3 uVerde;  // --success
uniform vec3 uMarino; // --navy, solo para dar fondo

float azar(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float ruido(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(azar(i), azar(i + vec2(1.0, 0.0)), f.x), mix(azar(i + vec2(0.0, 1.0)), azar(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 4; i++) { s += a * ruido(p); p = p * 2.02 + vec2(1.7, 9.2); a *= 0.5; }
  return s;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y + uPuntero * 0.05;
  float t = uT * 0.045;

  // Deformación de dominio: el ruido se empuja a sí mismo y por eso "fluye".
  vec2 q = vec2(fbm(p * 1.25 + vec2(0.0, t)), fbm(p * 1.25 + vec2(5.2, -t * 0.8)));
  float n = fbm(p * 1.55 + 1.9 * q + vec2(t * 0.6, 0.0));

  // Cintas de luz que cruzan el panel en diagonal.
  float onda = sin((p.y * 1.9 - p.x * 0.7 + n * 3.2 + q.x * 1.4) * 3.14159 + uT * 0.1);
  float cinta = pow(smoothstep(0.5, 1.0, onda), 2.2);
  float hilo = pow(smoothstep(0.93, 1.0, onda), 3.0);

  // Paleta: SOLO los colores de la marca (llegan de los tokens CSS). Domina
  // el azul claro institucional; el marino apenas da profundidad en las zonas
  // de sombra, y las cintas van en azul más claro y verde.
  vec3 hondo = mix(uAzul, uMarino, 0.42);
  vec3 claro = mix(uAzul, vec3(1.0), 0.26);

  vec3 col = mix(hondo, uAzul * 0.84, smoothstep(0.2, 0.8, n + (1.0 - uv.y) * 0.22 + uv.x * 0.12));
  col = mix(col, claro, cinta * 0.34 * smoothstep(0.25, 0.75, q.y));
  col = mix(col, uVerde, cinta * 0.3 * smoothstep(0.45, 0.85, q.x));
  col += vec3(1.0) * hilo * 0.08;

  // Un poco más hondo hacia los bordes: el texto blanco se lee siempre.
  float vi = smoothstep(1.3, 0.2, length(p * vec2(0.85, 1.0)));
  col *= mix(0.74, 1.0, vi);
  // Grano muy leve contra el bandeado del degradado.
  col += (azar(gl_FragCoord.xy + uT) - 0.5) * 0.012;
  gl_FragColor = vec4(col, 1.0);
}
`;

const VERT_RED = `
attribute vec3 aPos;
attribute vec3 aDato; // puntos: tamaño, verde, fase · líneas: opacidad, verde, 0
uniform float uGiro;
uniform float uInclina;
uniform float uAspecto;
uniform float uEscala;
uniform float uT;
uniform mediump float uLineas; // misma precisión que en el fragmento
varying float vA;
varying float vVerde;
void main() {
  float c = cos(uGiro), s = sin(uGiro);
  vec3 p = vec3(aPos.x * c + aPos.z * s, aPos.y, -aPos.x * s + aPos.z * c);
  float ci = cos(uInclina), si = sin(uInclina);
  p = vec3(p.x, p.y * ci - p.z * si, p.y * si + p.z * ci);
  float dist = 3.3 - p.z;
  vec2 xy = p.xy * (2.0 / dist);
  gl_Position = vec4(xy.x / uAspecto, xy.y, 0.0, 1.0);
  float cerca = clamp((p.z + 1.9) / 3.8, 0.0, 1.0);
  float brillo = 0.75 + 0.25 * sin(uT * 1.3 + aDato.z);
  gl_PointSize = aDato.x * uEscala * (0.45 + 1.5 * cerca * cerca) * brillo;
  vA = mix(0.16, 1.0, cerca * cerca) * (uLineas > 0.5 ? aDato.x * 0.75 : brillo);
  vVerde = aDato.y;
}
`;

const FRAG_RED = `
precision mediump float;
uniform float uLineas;
varying float vA;
varying float vVerde;
void main() {
  vec3 color = mix(vec3(1.0), vec3(0.55, 1.0, 0.62), vVerde);
  float a = vA;
  if (uLineas < 0.5) {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    // Núcleo nítido + halo suave.
    a *= smoothstep(1.0, 0.0, d) * 0.45 + smoothstep(0.32, 0.12, d) * 0.9;
  }
  gl_FragColor = vec4(color * a, a); // mezcla aditiva
}
`;

const PUNTOS = 150;
const RADIO = 2.0; // del cilindro donde viven los puntos
const ALTO = 2.1; // media altura
const ALCANCE = 0.62; // distancia 3D por debajo de la cual se unen

function programa(gl: WebGLRenderingContext, vert: string, frag: string) {
  const crear = (tipo: number, fuente: string) => {
    const s = gl.createShader(tipo);
    if (!s) return null;
    gl.shaderSource(s, fuente);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  };
  const v = crear(gl.VERTEX_SHADER, vert);
  const f = crear(gl.FRAGMENT_SHADER, frag);
  const p = gl.createProgram();
  if (!v || !f || !p) return null;
  gl.attachShader(p, v);
  gl.attachShader(p, f);
  gl.linkProgram(p);
  return gl.getProgramParameter(p, gl.LINK_STATUS) ? p : null;
}

/**
 * Un token de color del tema (oklch en el CSS) como RGB 0–1 para el
 * sombreador: se pinta en un lienzo de 1 px y se lee el píxel. Así los colores
 * del fondo son los de la marca y no una copia a mano.
 */
function colorDeToken(el: Element, token: string, respaldo: [number, number, number]): [number, number, number] {
  try {
    const valor = getComputedStyle(el).getPropertyValue(token).trim();
    const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    if (!valor || !ctx) return respaldo;
    ctx.fillStyle = "#000";
    ctx.fillStyle = valor;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return r + g + b === 0 ? respaldo : [r / 255, g / 255, b / 255];
  } catch {
    return respaldo;
  }
}

let soporte: boolean | null = null;
function hayWebgl() {
  if (soporte === null) {
    try {
      soporte = !!document.createElement("canvas").getContext("webgl");
    } catch {
      soporte = false;
    }
  }
  return soporte;
}
const sinSuscripcion = () => () => {};

export function FondoWebgl() {
  // En el servidor se asume que sí: el <canvas> es el mismo en ambos casos.
  const webgl = useSyncExternalStore(sinSuscripcion, hayWebgl, () => true);
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const lienzo = ref.current;
    if (!lienzo || !webgl) return;
    const gl = lienzo.getContext("webgl", { alpha: false, antialias: true, powerPreference: "low-power" });
    if (!gl) return;
    const pFondo = programa(gl, VERT_FONDO, FRAG_FONDO);
    const pRed = programa(gl, VERT_RED, FRAG_RED);
    if (!pFondo || !pRed) {
      // Sin sombreadores no hay nada que pintar: que se vea el degradado del panel.
      lienzo.style.display = "none";
      return;
    }

    // Windows con los "efectos de animación" apagados (muy común en equipos de
    // oficina) reporta «reducir movimiento». El fondo NO se congela por eso: es
    // lento y ambiental; solo va a media velocidad y sin seguir al puntero.
    const calmado = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // --- Geometría
    const cuadro = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cuadro);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    const pos = new Float32Array(PUNTOS * 3);
    const vel = new Float32Array(PUNTOS * 3);
    const dato = new Float32Array(PUNTOS * 3);
    for (let i = 0; i < PUNTOS; i++) {
      const r = RADIO * Math.sqrt(Math.random());
      const a = Math.random() * Math.PI * 2;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = (Math.random() * 2 - 1) * ALTO;
      pos[i * 3 + 2] = Math.sin(a) * r;
      for (let k = 0; k < 3; k++) vel[i * 3 + k] = (Math.random() - 0.5) * 0.07;
      dato[i * 3] = 10 + Math.random() * 13; // tamaño
      dato[i * 3 + 1] = i % 6 === 0 ? 1 : 0; // verde
      dato[i * 3 + 2] = Math.random() * 6.283; // fase del titileo
    }
    const bPos = gl.createBuffer();
    const bDato = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bDato);
    gl.bufferData(gl.ARRAY_BUFFER, dato, gl.STATIC_DRAW);

    const MAX_LINEAS = 900;
    const lPos = new Float32Array(MAX_LINEAS * 6);
    const lDato = new Float32Array(MAX_LINEAS * 6);
    const bLPos = gl.createBuffer();
    const bLDato = gl.createBuffer();

    const u = (p: WebGLProgram, n: string) => gl.getUniformLocation(p, n);
    const uF = { res: u(pFondo, "uRes"), t: u(pFondo, "uT"), puntero: u(pFondo, "uPuntero"), azul: u(pFondo, "uAzul"), verde: u(pFondo, "uVerde"), marino: u(pFondo, "uMarino") };
    const azul = colorDeToken(lienzo, "--primary", [0.12, 0.65, 0.88]);
    const verde = colorDeToken(lienzo, "--success", [0.18, 0.7, 0.27]);
    const marino = colorDeToken(lienzo, "--navy", [0.04, 0.14, 0.25]);
    const uR = { giro: u(pRed, "uGiro"), inclina: u(pRed, "uInclina"), aspecto: u(pRed, "uAspecto"), escala: u(pRed, "uEscala"), t: u(pRed, "uT"), lineas: u(pRed, "uLineas") };
    const aF = gl.getAttribLocation(pFondo, "aPos");
    const aP = gl.getAttribLocation(pRed, "aPos");
    const aD = gl.getAttribLocation(pRed, "aDato");

    let ancho = 0;
    let alto = 0;
    let dpr = 1;
    let cuadroId = 0;
    let previo = 0;
    let tiempo = Math.random() * 100;
    const puntero = { x: 0, y: 0, mx: 0, my: 0 };

    const ajustar = () => {
      const caja = lienzo.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      ancho = Math.round(caja.width * dpr);
      alto = Math.round(caja.height * dpr);
      if (ancho === 0 || alto === 0) return;
      lienzo.width = ancho;
      lienzo.height = alto;
      gl.viewport(0, 0, ancho, alto);

    };

    const mover = (dt: number) => {
      for (let i = 0; i < PUNTOS; i++) {
        const j = i * 3;
        pos[j] += vel[j] * dt;
        pos[j + 1] += vel[j + 1] * dt;
        pos[j + 2] += vel[j + 2] * dt;
        // Rebota en la pared del cilindro y en las tapas.
        if (pos[j] * pos[j] + pos[j + 2] * pos[j + 2] > RADIO * RADIO) {
          vel[j] = -vel[j];
          vel[j + 2] = -vel[j + 2];
          pos[j] += vel[j] * dt * 2;
          pos[j + 2] += vel[j + 2] * dt * 2;
        }
        if (Math.abs(pos[j + 1]) > ALTO) vel[j + 1] = -Math.sign(pos[j + 1]) * Math.abs(vel[j + 1]);
      }
    };

    const enlazar = () => {
      let n = 0;
      for (let i = 0; i < PUNTOS && n < MAX_LINEAS; i++) {
        const a = i * 3;
        for (let k = i + 1; k < PUNTOS && n < MAX_LINEAS; k++) {
          const b = k * 3;
          const dx = pos[a] - pos[b];
          const dy = pos[a + 1] - pos[b + 1];
          const dz = pos[a + 2] - pos[b + 2];
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 > ALCANCE * ALCANCE) continue;
          const fuerza = 1 - Math.sqrt(d2) / ALCANCE;
          const verde = dato[a + 1] || dato[b + 1];
          const o = n * 6;
          lPos.set([pos[a], pos[a + 1], pos[a + 2], pos[b], pos[b + 1], pos[b + 2]], o);
          lDato.set([fuerza, verde, 0, fuerza, verde, 0], o);
          n++;
        }
      }
      return n;
    };

    const pintar = (dt: number) => {
      if (ancho === 0 || alto === 0) return;
      tiempo += dt;
      puntero.x += (puntero.mx - puntero.x) * 0.04;
      puntero.y += (puntero.my - puntero.y) * 0.04;
      mover(dt);

      // 1. Aurora
      gl.disable(gl.BLEND);
      gl.useProgram(pFondo);
      gl.uniform2f(uF.res, ancho, alto);
      gl.uniform1f(uF.t, tiempo);
      gl.uniform2f(uF.puntero, puntero.x, puntero.y);
      gl.uniform3fv(uF.azul, azul);
      gl.uniform3fv(uF.verde, verde);
      gl.uniform3fv(uF.marino, marino);
      gl.bindBuffer(gl.ARRAY_BUFFER, cuadro);
      gl.enableVertexAttribArray(aF);
      gl.vertexAttribPointer(aF, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      // 2. Red en 3D, sumando luz sobre la aurora
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.useProgram(pRed);
      gl.uniform1f(uR.giro, tiempo * 0.035 + puntero.x * 0.3);
      gl.uniform1f(uR.inclina, 0.12 + puntero.y * 0.18);
      gl.uniform1f(uR.aspecto, ancho / alto);
      gl.uniform1f(uR.escala, (alto / 900) * 1);
      gl.uniform1f(uR.t, tiempo);
      gl.enableVertexAttribArray(aP);
      gl.enableVertexAttribArray(aD);

      const lineas = enlazar();
      gl.uniform1f(uR.lineas, 1);
      gl.bindBuffer(gl.ARRAY_BUFFER, bLPos);
      gl.bufferData(gl.ARRAY_BUFFER, lPos, gl.DYNAMIC_DRAW);
      gl.vertexAttribPointer(aP, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, bLDato);
      gl.bufferData(gl.ARRAY_BUFFER, lDato, gl.DYNAMIC_DRAW);
      gl.vertexAttribPointer(aD, 3, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.LINES, 0, lineas * 2);

      gl.uniform1f(uR.lineas, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, bPos);
      gl.bufferData(gl.ARRAY_BUFFER, pos, gl.DYNAMIC_DRAW);
      gl.vertexAttribPointer(aP, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, bDato);
      gl.vertexAttribPointer(aD, 3, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.POINTS, 0, PUNTOS);
    };

    const avanzar = (ahora: number) => {
      const dt = previo ? Math.min((ahora - previo) / 1000, 0.05) : 0.016;
      previo = ahora;
      pintar(calmado ? dt * 0.5 : dt);
      cuadroId = requestAnimationFrame(avanzar);
    };

    const alCambiarVisibilidad = () => {
      cancelAnimationFrame(cuadroId);
      previo = 0;
      if (!document.hidden) cuadroId = requestAnimationFrame(avanzar);
    };
    const alMover = (e: PointerEvent) => {
      puntero.mx = (e.clientX / window.innerWidth) * 2 - 1;
      puntero.my = (e.clientY / window.innerHeight) * 2 - 1;
    };

    const observador = new ResizeObserver(ajustar);
    observador.observe(lienzo);
    ajustar();
    cuadroId = requestAnimationFrame(avanzar);
    if (!calmado) window.addEventListener("pointermove", alMover, { passive: true });
    document.addEventListener("visibilitychange", alCambiarVisibilidad);

    return () => {
      cancelAnimationFrame(cuadroId);
      observador.disconnect();
      window.removeEventListener("pointermove", alMover);
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
    };
  }, [webgl]);

  if (!webgl) return <Constelacion />;
  return <canvas ref={ref} className="auth-constelacion" aria-hidden="true" />;
}
