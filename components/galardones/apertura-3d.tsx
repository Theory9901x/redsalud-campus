"use client";

/**
 * APERTURA 3D de la ceremonia (three.js / WebGL) · versión "holográfica".
 *
 * Espacio oscuro con aurora animada, rejilla de energía en el piso con ondas
 * que se expanden, una medalla dorada con giróscopo de anillos y un haz de
 * luz, y tres anillos de tarjetas de vidrio holográfico (uno por valor) con
 * bordes de neón. Todo pasa por bloom, así que lo brillante resplandece.
 *
 * Coreografía: la cámara entra en salto (warp), la medalla se enciende, las
 * 51 tarjetas salen disparadas y se acoplan a su anillo. Después todo sigue
 * vivo: los anillos giran en sentidos opuestos, flujos de datos recorren las
 * órbitas y el piso late. Se arrastra para girar y cada tarjeta lleva a su
 * centro (al tocarla, una onda sale desde ella).
 */

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Hand, RotateCcw } from "lucide-react";
import { ORDEN_VALORES, VALORES_GALARDON } from "@/lib/galardones/valores";
import type { GanadoresIps } from "@/lib/galardones/consultas";
import { nombreCentro, tipoCentro } from "@/lib/galardones/ips";

type Props = { centros: GanadoresIps[]; anio: number; institucion: string; onIr: (i: number) => void };
type Hover = { ips: string; valor: string; matiz: number } | null;
type Control = { repetir: () => void };

const EASE = [0.16, 1, 0.3, 1] as const;
/** Fin de la coreografía de entrada, en segundos. */
const FIN = 6.2;

export function Apertura3D({ centros, anio, institucion, onIr }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const chip = useRef<HTMLDivElement>(null);
  const onIrRef = useRef(onIr);
  const control = useRef<Control | null>(null);
  const reducir = useReducedMotion() ?? false;
  const [listo, setListo] = useState(false);
  const [hover, setHover] = useState<Hover>(null);
  const [sinWebgl, setSinWebgl] = useState(false);

  useEffect(() => {
    onIrRef.current = onIr;
  });

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let cancelado = false;
    let limpiar = () => {};
    (async () => {
      const [THREE, { EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }, { RoomEnvironment }] = await Promise.all([
        import("three"),
        import("three/examples/jsm/postprocessing/EffectComposer.js"),
        import("three/examples/jsm/postprocessing/RenderPass.js"),
        import("three/examples/jsm/postprocessing/UnrealBloomPass.js"),
        import("three/examples/jsm/postprocessing/OutputPass.js"),
        import("three/examples/jsm/environments/RoomEnvironment.js"),
      ]);
      await document.fonts?.ready;
      if (cancelado) return;
      try {
        limpiar = montar({ THREE, EffectComposer, RenderPass, UnrealBloomPass, OutputPass, RoomEnvironment }, el, {
          centros,
          anio,
          reducir,
          chip: () => chip.current,
          alHover: setHover,
          alListo: () => setListo(true),
          alIr: (i) => onIrRef.current(i),
          control,
        });
      } catch {
        setSinWebgl(true);
        setListo(true);
      }
    })();
    return () => {
      cancelado = true;
      limpiar();
    };
  }, [centros, anio, reducir]);

  const total = centros.length * ORDEN_VALORES.length;

  return (
    <div className="cer-a3d">
      <div ref={host} className="cer-a3d-lienzo" aria-hidden="true" />
      <div className="cer-a3d-vineta" aria-hidden="true" />

      {sinWebgl && (
        <div className="cer-a3d-respaldo">
          {centros.map((c, i) => (
            <button key={c.ips} type="button" onClick={() => onIr(i)}>
              {nombreCentro(c.ips)}
            </button>
          ))}
        </div>
      )}

      {/* HUD: arriba a la izquierda el título, arriba a la derecha las cifras */}
      <div className="cer-a3d-hud">
        <motion.header className="cer-a3d-titulo" initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 1.2, ease: EASE, delay: 0.5 }}>
          <p className="cer-a3d-cejilla">
            <span className="punto" aria-hidden="true" />
            {institucion} · Salud y Vida para el Llano
          </p>
          <h1 className="cer-display">
            Galardones <em>{anio}</em>
          </h1>
          <p className="cer-a3d-bajada">Reconocimiento al mérito · tres valores, una persona por valor en cada centro</p>
        </motion.header>

        <motion.dl className="cer-a3d-cifras" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 1.2, ease: EASE, delay: 0.8 }}>
          <div>
            <dt>Centros</dt>
            <dd>{String(centros.length).padStart(2, "0")}</dd>
          </div>
          <div>
            <dt>Galardones</dt>
            <dd>{String(total).padStart(2, "0")}</dd>
          </div>
          <div>
            <dt>Valores</dt>
            <dd>03</dd>
          </div>
        </motion.dl>

        <AnimatePresence>
          {listo && (
            <motion.footer className="cer-a3d-pie" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 14 }} transition={{ duration: 0.9, ease: EASE }}>
              <ul className="cer-a3d-leyenda" aria-label="Valores">
                {VALORES_GALARDON.map((v, i) => (
                  <li key={v.clave} style={{ ["--c-h" as string]: v.matiz }}>
                    <span aria-hidden="true" />
                    <b>{v.nombre}</b>
                    <small>Valor 0{i + 1}</small>
                  </li>
                ))}
              </ul>
              <div className="cer-a3d-acciones">
                <button type="button" className="cer-a3d-cta" onClick={() => onIr(0)}>
                  Empezar la ceremonia
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
                {!sinWebgl && (
                  <button
                    type="button"
                    className="cer-a3d-sec"
                    onClick={() => {
                      setListo(false);
                      control.current?.repetir();
                    }}
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    Repetir
                  </button>
                )}
              </div>
              {!sinWebgl && (
                <p className="cer-a3d-pista">
                  <Hand className="h-3.5 w-3.5" aria-hidden="true" />
                  Arrastra para girar · toca una tarjeta para ir a su centro
                </p>
              )}
            </motion.footer>
          )}
        </AnimatePresence>
      </div>

      <div ref={chip} className="cer-a3d-chip" data-visible={hover ? "" : undefined} style={hover ? { ["--c-h" as string]: hover.matiz } : undefined}>
        {hover && (
          <>
            <span className="vt" aria-hidden="true" />
            <b>{hover.ips}</b>
            <span>{hover.valor}</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </>
        )}
      </div>

      <nav className="sr-only" aria-label="Centros">
        {centros.map((c, i) => (
          <button key={c.ips} type="button" onClick={() => onIr(i)}>
            Ir a {nombreCentro(c.ips)}
          </button>
        ))}
      </nav>
    </div>
  );
}

/* ═════════════════════ Escena ═════════════════════ */

type Three = typeof import("three");
type Modulos = {
  THREE: Three;
  EffectComposer: typeof import("three/examples/jsm/postprocessing/EffectComposer.js").EffectComposer;
  RenderPass: typeof import("three/examples/jsm/postprocessing/RenderPass.js").RenderPass;
  UnrealBloomPass: typeof import("three/examples/jsm/postprocessing/UnrealBloomPass.js").UnrealBloomPass;
  OutputPass: typeof import("three/examples/jsm/postprocessing/OutputPass.js").OutputPass;
  RoomEnvironment: typeof import("three/examples/jsm/environments/RoomEnvironment.js").RoomEnvironment;
};
type Opciones = {
  centros: GanadoresIps[];
  anio: number;
  reducir: boolean;
  chip: () => HTMLDivElement | null;
  alHover: (h: Hover) => void;
  alListo: () => void;
  alIr: (i: number) => void;
  control: { current: Control | null };
};

/** El anillo: una tarjeta por centro, con sus tres valores. */
const ANILLO = { r: 5.5, y: 0.15, giro: 0.1 };
const CARTA = { w: 1.55, h: 2.17 };
const MEDALLA_Y = 3.5;
const PISO_Y = -2.75;

function azar(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
const suave = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const salida = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
const tramo = (t: number, a: number, b: number) => Math.min(1, Math.max(0, (t - a) / (b - a)));
const color = (matiz: number, l = 0.55, c = 0.14) => `oklch(${l} ${c} ${matiz})`;

function envolver(ctx: CanvasRenderingContext2D, texto: string, ancho: number) {
  const lineas: string[] = [];
  let linea = "";
  for (const p of texto.split(/\s+/)) {
    const prueba = linea ? `${linea} ${p}` : p;
    if (ctx.measureText(prueba).width > ancho && linea) {
      lineas.push(linea);
      linea = p;
    } else linea = prueba;
  }
  if (linea) lineas.push(linea);
  return lineas;
}

function redondeado(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function estrella(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.44 : r;
    ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath();
}

/** Esquinas tipo visor (HUD) en un rectángulo. */
function esquinas(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, l: number) {
  ctx.beginPath();
  ctx.moveTo(x, y + l); ctx.lineTo(x, y); ctx.lineTo(x + l, y);
  ctx.moveTo(x + w - l, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + l);
  ctx.moveTo(x + w, y + h - l); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - l, y + h);
  ctx.moveTo(x + l, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - l);
  ctx.stroke();
}

/* ── Shaders ── */
const CIELO_VERT = `
varying vec3 vPos;
void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const CIELO_FRAG = `
uniform float uTime;
varying vec3 vPos;
float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float v = 0.0; float a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
void main() {
  vec3 d = normalize(vPos);
  float h = d.y * 0.5 + 0.5;
  vec3 base = mix(vec3(0.004, 0.008, 0.022), vec3(0.012, 0.03, 0.07), smoothstep(0.2, 0.9, h));
  float n = fbm(d * 2.4 + vec3(uTime * 0.025, uTime * 0.04, 0.0));
  float banda = smoothstep(0.42, 0.78, n) * smoothstep(0.15, 0.55, h) * (1.0 - smoothstep(0.75, 1.0, h));
  vec3 aurora = mix(vec3(0.0, 0.28, 0.36), vec3(0.22, 0.1, 0.42), smoothstep(0.3, 0.8, fbm(d * 4.0 - uTime * 0.03)));
  base += aurora * banda * 0.55;
  float brillo = pow(max(0.0, 1.0 - abs(d.y - 0.12) * 3.0), 3.0) * 0.06;
  base += vec3(0.25, 0.18, 0.05) * brillo;
  gl_FragColor = vec4(base, 1.0);
}
`;
const PISO_VERT = `
varying vec3 vW;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }
`;
const PISO_FRAG = `
uniform float uTime;
uniform float uPulso;
uniform vec2 uOrigen;
uniform vec3 uColor;
varying vec3 vW;
void main() {
  vec2 p = vW.xz * 0.9;
  vec2 g = abs(fract(p - 0.5) - 0.5) / fwidth(p);
  float linea = 1.0 - min(min(g.x, g.y), 1.0);
  float r = length(vW.xz);
  float fade = smoothstep(19.0, 2.5, r);
  float onda = exp(-pow(r - mod(uTime * 3.2, 22.0), 2.0) * 0.5);
  float dt = uTime - uPulso;
  float rp = length(vW.xz - uOrigen);
  float golpe = dt > 0.0 && dt < 3.0 ? exp(-pow(rp - dt * 7.0, 2.0) * 0.8) * (1.0 - dt / 3.0) : 0.0;
  float anillos = 0.0;
  anillos += exp(-pow(r - 5.5, 2.0) * 22.0) + exp(-pow(r - 1.6, 2.0) * 30.0) * 0.6;
  float a = linea * 0.22 + onda * (0.25 + linea * 0.6) + golpe * (0.35 + linea) + anillos * 0.18;
  gl_FragColor = vec4(uColor * a * fade, a * fade);
}
`;

function montar(m: Modulos, el: HTMLDivElement, o: Opciones) {
  const { THREE } = m;
  const fuente = getComputedStyle(el).fontFamily || "system-ui, sans-serif";
  const desechables: { dispose: () => void }[] = [];
  const guardar = <T extends { dispose: () => void }>(x: T) => {
    desechables.push(x);
    return x;
  };

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
  renderer.setPixelRatio(dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x02040b, 1);
  el.appendChild(renderer.domElement);
  const anisotropia = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const scene = new THREE.Scene();
  // Reflejos para el oro (no se ve de fondo: el cielo es la esfera de aurora).
  const pmrem = guardar(new THREE.PMREMGenerator(renderer));
  scene.environment = guardar(pmrem.fromScene(new m.RoomEnvironment(), 0.04).texture);
  scene.environmentIntensity = 0.7;
  scene.fog = new THREE.FogExp2(0x02040b, 0.028);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 400);
  const raiz = new THREE.Group();
  scene.add(raiz);

  scene.add(new THREE.AmbientLight(0x8fa8ff, 0.5));
  const clave = new THREE.PointLight(0xffd18a, 14, 30, 1.6);
  clave.position.set(0, MEDALLA_Y + 1.5, 3.5);
  scene.add(clave);
  const contra = new THREE.PointLight(0x47c8ff, 30, 30, 1.6);
  contra.position.set(-4, MEDALLA_Y, -4);
  scene.add(contra);

  // three.js no entiende oklch: el navegador lo convierte pintando un píxel.
  const pixel = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
  const colorThree = (css: string) => {
    pixel.clearRect(0, 0, 1, 1);
    pixel.fillStyle = css;
    pixel.fillRect(0, 0, 1, 1);
    const [r, g, b] = pixel.getImageData(0, 0, 1, 1).data;
    return new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
  };

  const lienzo = (w: number, h: number, dibujar: (ctx: CanvasRenderingContext2D) => void) => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    dibujar(c.getContext("2d")!);
    const t = guardar(new THREE.CanvasTexture(c));
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = anisotropia;
    return t;
  };

  /* ── Cielo con aurora ── */
  const uniCielo = { uTime: { value: 0 } };
  const cielo = new THREE.Mesh(
    guardar(new THREE.SphereGeometry(180, 48, 24)),
    guardar(new THREE.ShaderMaterial({ uniforms: uniCielo, vertexShader: CIELO_VERT, fragmentShader: CIELO_FRAG, side: THREE.BackSide, depthWrite: false, fog: false })),
  );
  scene.add(cielo);

  /* ── Estrellas (campo lejano, dan la sensación de salto) ── */
  const NE = 1400;
  const posE = new Float32Array(NE * 3);
  for (let i = 0; i < NE; i++) {
    const u = azar(i + 3000) * Math.PI * 2;
    const w = Math.acos(2 * azar(i + 4000) - 1);
    const r = 30 + azar(i + 5000) * 120;
    posE.set([Math.sin(w) * Math.cos(u) * r, Math.cos(w) * r * 0.7, Math.sin(w) * Math.sin(u) * r], i * 3);
  }
  const geoE = guardar(new THREE.BufferGeometry());
  geoE.setAttribute("position", new THREE.BufferAttribute(posE, 3));
  const puntoTex = lienzo(64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.3, "rgba(255,255,255,0.75)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });
  const estrellas = new THREE.Points(geoE, guardar(new THREE.PointsMaterial({ size: 0.45, map: puntoTex, color: 0xbcd4ff, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })));
  scene.add(estrellas);

  /* ── Piso holográfico ── */
  const uniPiso = { uTime: { value: 0 }, uPulso: { value: -99 }, uOrigen: { value: new THREE.Vector2() }, uColor: { value: new THREE.Color(0x3fd2ff) } };
  const piso = new THREE.Mesh(
    guardar(new THREE.PlaneGeometry(60, 60)),
    guardar(new THREE.ShaderMaterial({ uniforms: uniPiso, vertexShader: PISO_VERT, fragmentShader: PISO_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })),
  );
  piso.rotation.x = -Math.PI / 2;
  piso.position.y = PISO_Y;
  raiz.add(piso);

  /* ── Medalla con giróscopo ── */
  const oro = guardar(new THREE.MeshStandardMaterial({ color: 0xf0bd55, metalness: 1, roughness: 0.2, emissive: 0x6a4000, emissiveIntensity: 0.55 }));
  const caraMedalla = lienzo(512, 512, (ctx) => {
    const g = ctx.createRadialGradient(200, 170, 20, 256, 256, 260);
    g.addColorStop(0, "#fff2c2");
    g.addColorStop(0.55, "#e6b552");
    g.addColorStop(1, "#a46d18");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);
    // La tapa del cilindro, ya girado hacia la cámara, mapea la textura rotada 90°.
    ctx.translate(256, 256);
    ctx.rotate(-Math.PI / 2);
    ctx.translate(-256, -256);
    ctx.strokeStyle = "rgba(110,70,10,0.55)";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(256, 256, 226, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 10]);
    ctx.beginPath();
    ctx.arc(256, 256, 204, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(70,40,4,0.95)";
    estrella(ctx, 256, 176, 62);
    ctx.fill();
    ctx.textAlign = "center";
    ctx.font = `800 104px ${fuente}`;
    ctx.fillText(String(o.anio), 256, 338);
    ctx.font = `800 28px ${fuente}`;
    ctx.fillText("G A L A R D O N E S", 256, 392);
  });
  const caraOro = guardar(new THREE.MeshStandardMaterial({ map: caraMedalla, metalness: 0.7, roughness: 0.32, emissive: 0x000000, emissiveIntensity: 0 }));
  const medalla = new THREE.Group();
  const pivote = new THREE.Group();
  const disco = new THREE.Mesh(guardar(new THREE.CylinderGeometry(1.05, 1.05, 0.16, 96)), [oro, caraOro, caraOro]);
  disco.rotation.x = Math.PI / 2;
  pivote.add(disco);
  medalla.add(pivote);
  // Giróscopo: un aro por valor, de neón.
  const aros = VALORES_GALARDON.map((v, i) => {
    const mat = guardar(new THREE.MeshBasicMaterial({ color: colorThree(color(v.matiz, 0.78, 0.17)).multiplyScalar(2.2), toneMapped: false, transparent: true, opacity: 0.95 }));
    const aro = new THREE.Mesh(guardar(new THREE.TorusGeometry(1.4 + i * 0.16, 0.012, 8, 200)), mat);
    medalla.add(aro);
    return aro;
  });
  const aroOro = new THREE.Mesh(guardar(new THREE.TorusGeometry(1.2, 0.03, 12, 160)), oro);
  medalla.add(aroOro);
  const halo = new THREE.Sprite(
    guardar(
      new THREE.SpriteMaterial({
        map: lienzo(256, 256, (ctx) => {
          const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
          g.addColorStop(0, "rgba(255,200,110,0.9)");
          g.addColorStop(0.35, "rgba(255,170,70,0.28)");
          g.addColorStop(1, "rgba(255,170,70,0)");
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, 256, 256);
        }),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    ),
  );
  halo.scale.set(7, 7, 1);
  halo.position.z = -0.5;
  medalla.add(halo);
  medalla.position.y = MEDALLA_Y;
  raiz.add(medalla);

  // Haz de luz de la medalla al piso.
  const haz = new THREE.Mesh(
    guardar(new THREE.CylinderGeometry(0.55, 1.6, MEDALLA_Y - PISO_Y, 48, 1, true)),
    guardar(
      new THREE.MeshBasicMaterial({
        map: lienzo(8, 256, (ctx) => {
          const g = ctx.createLinearGradient(0, 0, 0, 256);
          g.addColorStop(0, "rgba(255,200,120,0.55)");
          g.addColorStop(0.5, "rgba(120,200,255,0.12)");
          g.addColorStop(1, "rgba(120,200,255,0)");
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, 8, 256);
        }),
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        fog: false,
      }),
    ),
  );
  haz.position.y = (MEDALLA_Y + PISO_Y) / 2;
  raiz.add(haz);

  /* ── Tarjetas holográficas: una por centro, con sus tres valores ── */
  const geoCarta = guardar(new THREE.PlaneGeometry(CARTA.w, CARTA.h));
  const geoBorde = guardar(new THREE.EdgesGeometry(geoCarta));
  type Carta = {
    grupo: InstanceType<Three["Group"]>;
    frente: InstanceType<Three["Mesh"]>;
    bordeMat: InstanceType<Three["LineBasicMaterial"]>;
    k: number;
    c: number;
    ips: string;
    dispersa: InstanceType<Three["Vector3"]>;
    giroDisperso: InstanceType<Three["Quaternion"]>;
    retraso: number;
    hover: number;
  };
  const n = o.centros.length;
  const cartas: Carta[] = [];
  const CIAN = "oklch(0.86 0.12 205)";
  const dorso = guardar(
    new THREE.MeshBasicMaterial({
      transparent: true,
      map: lienzo(512, 716, (ctx) => {
        redondeado(ctx, 6, 6, 500, 704, 30);
        const g = ctx.createLinearGradient(0, 0, 512, 716);
        g.addColorStop(0, "rgba(60,40,8,0.82)");
        g.addColorStop(1, "rgba(14,10,4,0.82)");
        ctx.fillStyle = g;
        ctx.fill();
        ctx.strokeStyle = "rgba(255,210,120,0.9)";
        ctx.lineWidth = 4;
        esquinas(ctx, 28, 28, 456, 660, 40);
        ctx.fillStyle = "rgba(255,206,110,0.95)";
        estrella(ctx, 256, 300, 90);
        ctx.fill();
        ctx.textAlign = "center";
        ctx.font = `800 40px ${fuente}`;
        ctx.fillText(`GALARDONES ${o.anio}`, 256, 470);
      }),
    }),
  );
  const bordeColor = colorThree(CIAN).multiplyScalar(1.5);
  o.centros.forEach((centro, c) => {
    const k = c;
    const frenteMat = guardar(
      new THREE.MeshBasicMaterial({
        transparent: true,
        map: lienzo(512, 716, (ctx) => {
          // Vidrio oscuro
          redondeado(ctx, 6, 6, 500, 704, 30);
          ctx.fillStyle = "rgba(5,12,30,0.86)";
          ctx.fill();
          const brillo = ctx.createLinearGradient(0, 0, 0, 716);
          brillo.addColorStop(0, "rgba(255,255,255,0.12)");
          brillo.addColorStop(0.3, "rgba(255,255,255,0)");
          ctx.fillStyle = brillo;
          ctx.fill();
          ctx.save();
          ctx.clip();
          const barra = ctx.createLinearGradient(0, 0, 512, 0);
          VALORES_GALARDON.forEach((v, i) => {
            barra.addColorStop(i / 2, color(v.matiz, 0.7, 0.17));
          });
          ctx.fillStyle = barra;
          ctx.fillRect(0, 0, 512, 14);
          ctx.fillStyle = "rgba(255,255,255,0.03)";
          for (let y = 20; y < 716; y += 5) ctx.fillRect(0, y, 512, 1);
          ctx.restore();
          ctx.strokeStyle = CIAN;
          ctx.lineWidth = 3;
          esquinas(ctx, 26, 36, 460, 650, 30);

          ctx.textAlign = "center";
          ctx.fillStyle = CIAN;
          ctx.font = `700 24px ${fuente}`;
          ctx.fillText(`CENTRO ${String(c + 1).padStart(2, "0")} / ${String(n).padStart(2, "0")}`, 256, 92);

          // Nombre del centro
          ctx.fillStyle = "#f5f8ff";
          let tam = 78;
          let lineas: string[] = [];
          for (;;) {
            ctx.font = `800 ${tam}px ${fuente}`;
            lineas = envolver(ctx, nombreCentro(centro.ips), 420);
            const cabe = lineas.length <= 3 && lineas.every((l) => ctx.measureText(l).width <= 440);
            if (cabe || tam <= 36) break;
            tam -= 3;
          }
          const alto = tam * 1.05;
          const y0 = 205 - ((lineas.length - 1) * alto) / 2;
          lineas.forEach((l, i) => ctx.fillText(l, 256, y0 + i * alto));
          ctx.fillStyle = "rgba(210,222,255,0.6)";
          ctx.font = `700 22px ${fuente}`;
          ctx.fillText(tipoCentro(centro.ips).toUpperCase(), 256, y0 + lineas.length * alto + 6);

          // Los tres valores del centro
          VALORES_GALARDON.forEach((v, i) => {
            const y = 392 + i * 78;
            const neon = color(v.matiz, 0.8, 0.16);
            redondeado(ctx, 52, y, 408, 62, 14);
            ctx.fillStyle = color(v.matiz, 0.3, 0.08).replace(")", " / 0.55)");
            ctx.fill();
            ctx.strokeStyle = color(v.matiz, 0.75, 0.15).replace(")", " / 0.6)");
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.fillStyle = neon;
            ctx.fillRect(52, y, 8, 62);
            ctx.textAlign = "left";
            ctx.font = `700 22px ${fuente}`;
            ctx.fillText(`0${v.numero}`, 78, y + 40);
            ctx.fillStyle = "#eef3ff";
            ctx.font = `800 28px ${fuente}`;
            ctx.fillText(v.nombre, 124, y + 41);
            ctx.fillStyle = neon;
            estrella(ctx, 428, y + 31, 13);
            ctx.fill();
          });

          // Pie tipo código
          ctx.textAlign = "center";
          ctx.fillStyle = "rgba(255,255,255,0.32)";
          for (let i = 0; i < 40; i++) {
            const w = azar(k * 31 + i) > 0.5 ? 5 : 2;
            ctx.fillRect(116 + i * 7, 640, w, 22);
          }
          ctx.fillStyle = "rgba(220,230,255,0.55)";
          ctx.font = `700 18px ${fuente}`;
          ctx.fillText(`3 GALARDONES · ${o.anio}`, 256, 690);
        }),
      }),
    );
    const grupo = new THREE.Group();
    const frente = new THREE.Mesh(geoCarta, frenteMat);
    frente.userData.k = k;
    const atras = new THREE.Mesh(geoCarta, dorso);
    atras.rotation.y = Math.PI;
    const bordeMat = guardar(new THREE.LineBasicMaterial({ color: bordeColor, transparent: true, opacity: 0.55, toneMapped: false }));
    const borde = new THREE.LineSegments(geoBorde, bordeMat);
    grupo.add(frente, atras, borde);
    raiz.add(grupo);

    const u = azar(k + 1) * Math.PI * 2;
    const w = Math.acos(2 * azar(k + 7) - 1);
    const rad = 5 + azar(k + 13) * 5;
    const dispersa = new THREE.Vector3(Math.sin(w) * Math.cos(u) * rad, Math.cos(w) * rad * 0.5 + 1, Math.sin(w) * Math.sin(u) * rad);
    const giroDisperso = new THREE.Quaternion().setFromEuler(new THREE.Euler((azar(k + 3) - 0.5) * 2.4, azar(k + 5) * Math.PI * 2, (azar(k + 9) - 0.5) * 1.6));
    cartas.push({ grupo, frente, bordeMat, k, c, ips: nombreCentro(centro.ips), dispersa, giroDisperso, retraso: azar(k + 21) * 0.9, hover: 0 });
  });
  const mallas = cartas.map((x) => x.frente);

  /* ── Flujos de datos: dos corrientes, sobre y bajo el anillo ── */
  const NF = 120;
  const posF = new Float32Array(NF * 3);
  const colF = new Float32Array(NF * 3);
  const fase = new Float32Array(NF);
  for (let j = 0; j < NF; j++) {
    const v = VALORES_GALARDON[j % 3];
    const cc = colorThree(color(v.matiz, 0.8, 0.17)).multiplyScalar(1.8);
    fase[j] = azar(j + 7000) * Math.PI * 2;
    colF.set([cc.r, cc.g, cc.b], j * 3);
  }
  const geoF = guardar(new THREE.BufferGeometry());
  geoF.setAttribute("position", new THREE.BufferAttribute(posF, 3));
  geoF.setAttribute("color", new THREE.BufferAttribute(colF, 3));
  const flujos = new THREE.Points(geoF, guardar(new THREE.PointsMaterial({ size: 0.13, map: puntoTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })));
  raiz.add(flujos);

  /* ── Polvo dorado que sube ── */
  const P = 500;
  const pos = new Float32Array(P * 3);
  const vel = new Float32Array(P);
  for (let i = 0; i < P; i++) {
    const a = azar(i + 500) * Math.PI * 2;
    const r = 1.2 + Math.sqrt(azar(i + 900)) * 11;
    pos.set([Math.cos(a) * r, PISO_Y + azar(i + 1300) * 10, Math.sin(a) * r], i * 3);
    vel[i] = 0.12 + azar(i + 1700) * 0.4;
  }
  const geoPolvo = guardar(new THREE.BufferGeometry());
  geoPolvo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const polvo = new THREE.Points(geoPolvo, guardar(new THREE.PointsMaterial({ size: 0.07, map: puntoTex, color: 0xffcf7a, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending })));
  raiz.add(polvo);

  /* ── Posprocesado: bloom ── */
  const composer = new m.EffectComposer(renderer);
  composer.setPixelRatio(dpr);
  composer.addPass(new m.RenderPass(scene, camera));
  const bloom = new m.UnrealBloomPass(new THREE.Vector2(1, 1), 0.62, 0.5, 0.8);
  composer.addPass(bloom);
  composer.addPass(new m.OutputPass());

  /* ── Encuadre ── */
  const objetivo = new THREE.Vector3();
  let distancia = 18;
  const encuadrar = () => {
    const w = el.clientWidth || 1;
    const h = el.clientHeight || 1;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    bloom.resolution.set(w, h);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    camera.aspect = w / h;
    const tan = Math.tan(THREE.MathUtils.degToRad(36 / 2));
    // Que quepan los anillos de lado a lado y, en alto, la medalla y el piso.
    distancia = Math.max(7.0 / (tan * camera.aspect), 6.3 / tan);
    objetivo.set(0, w < 700 ? 1.0 : 0.05, 0);
    camera.updateProjectionMatrix();
  };
  encuadrar();
  const ro = new ResizeObserver(encuadrar);
  ro.observe(el);

  /* ── Puntero: arrastrar, hover y clic ── */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2(9, 9);
  let arrastre = 0;
  let inercia = 0;
  let abajo: { x: number; y: number } | null = null;
  let ultimoX = 0;
  let encima = -1;
  const canvas = renderer.domElement;
  canvas.style.touchAction = "none";
  canvas.style.cursor = "grab";

  const apuntar = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  };
  const tocada = () => {
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(mallas, false)[0];
    return hit ? (hit.object.userData.k as number) : -1;
  };
  let reloj = 0;
  const alMover = (e: PointerEvent) => {
    apuntar(e);
    if (abajo) {
      const dx = e.clientX - ultimoX;
      ultimoX = e.clientX;
      arrastre += dx * 0.006;
      inercia = dx * 0.006 * 60;
    }
  };
  const alBajar = (e: PointerEvent) => {
    apuntar(e);
    abajo = { x: e.clientX, y: e.clientY };
    ultimoX = e.clientX;
    inercia = 0;
    canvas.setPointerCapture(e.pointerId);
  };
  const alSubir = (e: PointerEvent) => {
    apuntar(e);
    if (abajo && Math.hypot(e.clientX - abajo.x, e.clientY - abajo.y) < 7) {
      const k = tocada();
      if (k >= 0) {
        const p = cartas[k].grupo.position;
        uniPiso.uOrigen.value.set(p.x, p.z);
        uniPiso.uPulso.value = reloj;
        const centro = cartas[k].c;
        setTimeout(() => o.alIr(centro), 380);
      }
    }
    abajo = null;
  };
  const alSalir = () => {
    if (!abajo) ndc.set(9, 9);
  };
  const alRueda = (e: WheelEvent) => {
    inercia += (e.deltaY + e.deltaX) * -0.004;
  };
  canvas.addEventListener("pointermove", alMover);
  canvas.addEventListener("pointerdown", alBajar);
  canvas.addEventListener("pointerup", alSubir);
  canvas.addEventListener("pointerleave", alSalir);
  canvas.addEventListener("wheel", alRueda, { passive: true });

  /* ── Animación ── */
  let inicio = performance.now() - (o.reducir ? FIN * 1000 + 100 : 0);
  let avisado = false;
  o.control.current = {
    repetir: () => {
      inicio = performance.now();
      avisado = false;
      arrastre = 0;
      inercia = 0;
    },
  };

  const vFinal = new THREE.Vector3();
  const vTmp = new THREE.Vector3();
  const qFinal = new THREE.Quaternion();
  const qTmp = new THREE.Quaternion();
  const qGiro = new THREE.Quaternion();
  const ejeY = new THREE.Vector3(0, 1, 0);
  const origen = new THREE.Vector3(0, MEDALLA_Y, 0);
  const encimaCarta = new THREE.Vector3(0, CARTA.h * 0.72, 0);
  let antes = performance.now();
  let raf = 0;

  const cuadro = (ahora: number) => {
    raf = requestAnimationFrame(cuadro);
    const dt = Math.min(0.05, (ahora - antes) / 1000);
    antes = ahora;
    const t = (ahora - inicio) / 1000;
    reloj = ahora / 1000;
    const mov = o.reducir ? 0 : 1;
    uniCielo.uTime.value = reloj;
    uniPiso.uTime.value = reloj;

    if (!abajo) {
      arrastre += inercia * dt;
      inercia *= Math.pow(0.04, dt);
    }

    // Cámara: salto warp (lejos, gran angular) y llegada; luego respira con el puntero.
    const entrada = o.reducir ? 1 : suave(tramo(t, 0, 3.6));
    camera.fov = THREE.MathUtils.lerp(78, 36, entrada);
    camera.updateProjectionMatrix();
    const elev = THREE.MathUtils.lerp(0.75, 0.3, entrada);
    const d = distancia * THREE.MathUtils.lerp(2.6, 1, entrada);
    const px = ndc.x > 5 ? 0 : ndc.x * mov;
    const py = ndc.y > 5 ? 0 : ndc.y * mov;
    const az = px * 0.14 + (1 - entrada) * 1.2 + Math.sin(reloj * 0.09) * 0.22 * mov;
    const el2 = elev + py * 0.05;
    camera.position.set(Math.sin(az) * Math.cos(el2) * d, objetivo.y + Math.sin(el2) * d, Math.cos(az) * Math.cos(el2) * d);
    camera.lookAt(objetivo);
    estrellas.rotation.y = reloj * 0.004 + (1 - entrada) * 0.6;

    // Medalla: se enciende, gira el giróscopo.
    const aparece = o.reducir ? 1 : salida(tramo(t, 0.6, 1.9));
    medalla.scale.setScalar(0.001 + aparece);
    medalla.position.y = MEDALLA_Y + Math.sin(reloj * 1.1) * 0.08 * mov;
    pivote.rotation.y = (1 - aparece) * Math.PI * 4 + Math.sin(reloj * 0.55) * 0.45 * mov;
    aros.forEach((aro, i) => {
      aro.rotation.set(reloj * (0.35 + i * 0.12) * mov + i, reloj * (0.5 - i * 0.18) * mov + i * 1.3, i * 0.7);
    });
    aroOro.rotation.set(Math.PI / 2 + Math.sin(reloj * 0.4) * 0.25 * mov, 0, reloj * 0.2 * mov);
    (haz.material as InstanceType<Three["MeshBasicMaterial"]>).opacity = aparece * (0.42 + Math.sin(reloj * 2.2) * 0.08 * mov);
    halo.material.opacity = aparece * (0.32 + Math.sin(reloj * 1.7) * 0.08 * mov);

    // Hover (solo cuando ya están en sus anillos)
    const k = abajo || t < FIN * 0.85 ? -1 : tocada();
    if (k !== encima) {
      encima = k;
      canvas.style.cursor = k >= 0 ? "pointer" : "grab";
      o.alHover(k >= 0 ? { ips: cartas[k].ips, valor: "Ver sus 3 galardones", matiz: 205 } : null);
    }

    for (const x of cartas) {
      const ang = (x.c / n) * Math.PI * 2 + ANILLO.giro * reloj * mov + arrastre;
      x.hover += ((encima === x.k ? 1 : 0) - x.hover) * Math.min(1, dt * 12);
      const r = ANILLO.r + x.hover * 0.8;
      vFinal.set(Math.sin(ang) * r, ANILLO.y + x.hover * 0.25 + Math.sin(reloj * 1.2 + x.c * 0.8) * 0.09 * mov, Math.cos(ang) * r);
      qFinal.setFromAxisAngle(ejeY, ang);

      // 1) estalla desde la medalla  2) flota  3) se acopla al anillo
      const p1 = salida(tramo(t, 1.2 + x.retraso * 0.5, 2.8 + x.retraso * 0.5));
      const p2 = suave(tramo(t, 3.0 + x.retraso, 5.0 + x.retraso));
      vTmp.copy(x.dispersa);
      vTmp.y += Math.sin(reloj * 0.9 + x.retraso * 9) * 0.3 * mov;
      vTmp.lerpVectors(origen, vTmp, p1);
      x.grupo.position.lerpVectors(vTmp, vFinal, p2);
      qGiro.setFromAxisAngle(ejeY, reloj * 0.6 * mov);
      qTmp.copy(qGiro).multiply(x.giroDisperso);
      x.grupo.quaternion.slerpQuaternions(qTmp, qFinal, p2);
      x.grupo.scale.setScalar((0.001 + p1) * (1 + x.hover * 0.16));
      const acople = p2 >= 1 ? Math.max(0, 1 - (t - (5.0 + x.retraso)) * 2.5) : 0;
      x.bordeMat.opacity = Math.min(1, 0.45 + x.hover * 0.55 + acople * 0.5 + Math.sin(reloj * 2 + x.k) * 0.08 * mov);
    }

    // Flujos de datos: recorren la órbita sobre y bajo las tarjetas.
    const visible = o.reducir ? 1 : tramo(t, 4.2, 5.6);
    for (let j = 0; j < NF; j++) {
      const nivel = j % 2 ? 1 : -1;
      const ang = fase[j] + reloj * (0.45 + (j % 5) * 0.07) * nivel * (mov || 0.02) + arrastre;
      const rr = ANILLO.r + 0.35 + Math.sin(j * 1.7) * 0.1;
      posF.set([Math.sin(ang) * rr, ANILLO.y + nivel * CARTA.h * 0.6 + Math.sin(j) * 0.05, Math.cos(ang) * rr], j * 3);
    }
    geoF.attributes.position.needsUpdate = true;
    (flujos.material as InstanceType<Three["PointsMaterial"]>).opacity = visible;

    // Polvo que sube
    if (mov) {
      for (let i = 0; i < P; i++) {
        pos[i * 3 + 1] += vel[i] * dt;
        if (pos[i * 3 + 1] > 8) pos[i * 3 + 1] = PISO_Y;
      }
      geoPolvo.attributes.position.needsUpdate = true;
      polvo.rotation.y += dt * 0.03;
    }

    // Etiqueta que sigue a la tarjeta
    const ch = o.chip();
    if (ch && encima >= 0) {
      vTmp.copy(cartas[encima].grupo.position).add(encimaCarta).project(camera);
      ch.style.transform = `translate(${((vTmp.x + 1) / 2) * el.clientWidth}px, ${((1 - vTmp.y) / 2) * el.clientHeight}px) translate(-50%, -100%)`;
    }

    if (!avisado && t >= FIN) {
      avisado = true;
      o.alListo();
    }
    composer.render();
  };
  raf = requestAnimationFrame(cuadro);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    canvas.removeEventListener("pointermove", alMover);
    canvas.removeEventListener("pointerdown", alBajar);
    canvas.removeEventListener("pointerup", alSubir);
    canvas.removeEventListener("pointerleave", alSalir);
    canvas.removeEventListener("wheel", alRueda);
    o.control.current = null;
    desechables.forEach((x) => x.dispose());
    bloom.dispose();
    composer.dispose();
    renderer.dispose();
    canvas.remove();
  };
}
