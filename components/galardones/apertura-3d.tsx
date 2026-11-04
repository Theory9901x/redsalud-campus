"use client";

/**
 * APERTURA 3D de la ceremonia (three.js / WebGL).
 * Una medalla dorada al centro y tres anillos de tarjetas en órbita, uno por
 * valor (Integridad adentro, Humanización al medio, Liderazgo afuera). Las 51
 * tarjetas salen disparadas de la medalla, flotan y se ordenan en sus anillos.
 * Se arrastra para girar y cada tarjeta lleva a su centro.
 */

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Hand, RotateCcw } from "lucide-react";
import { ORDEN_VALORES, VALORES_GALARDON, valorInfo } from "@/lib/galardones/valores";
import type { GanadoresIps } from "@/lib/galardones/consultas";

type Props = { centros: GanadoresIps[]; anio: number; institucion: string; onIr: (i: number) => void };
type Hover = { ips: string; valor: string; matiz: number } | null;
type Control = { repetir: () => void };

const EASE = [0.16, 1, 0.3, 1] as const;
/** Fin de la coreografía de entrada, en segundos. */
const FIN = 5.6;

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
      const [THREE, { RoomEnvironment }] = await Promise.all([import("three"), import("three/examples/jsm/environments/RoomEnvironment.js")]);
      await document.fonts?.ready;
      if (cancelado) return;
      try {
        limpiar = montar(THREE, RoomEnvironment, el, {
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

  return (
    <div className="cer-a3d">
      <div ref={host} className="cer-a3d-lienzo" aria-hidden="true" />

      {sinWebgl && (
        <div className="cer-a3d-respaldo">
          {centros.map((c, i) => (
            <button key={c.ips} type="button" onClick={() => onIr(i)}>
              {c.ips}
            </button>
          ))}
        </div>
      )}

      <div className="cer-a3d-capa">
        <motion.header className="cer-a3d-titulo" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.1, ease: EASE, delay: 0.2 }}>
          <p className="cer-a3d-cejilla">{institucion} · Salud y Vida para el Llano</p>
          <h1 className="cer-display">
            Galardones <em>{anio}</em>
          </h1>
        </motion.header>

        <AnimatePresence>
          {listo && (
            <motion.footer
              className="cer-a3d-pie"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.8, ease: EASE }}
            >
              <ul className="cer-a3d-leyenda" aria-label="Anillos">
                {VALORES_GALARDON.map((v, i) => (
                  <li key={v.clave} style={{ ["--c-h" as string]: v.matiz }}>
                    <span aria-hidden="true" />
                    {v.nombre}
                    <small>{["anillo interior", "anillo medio", "anillo exterior"][i]}</small>
                  </li>
                ))}
              </ul>
              <p className="cer-a3d-cifra">
                <b>{centros.length}</b> centros · <b>{centros.length * ORDEN_VALORES.length}</b> galardones
              </p>
              <div className="cer-a3d-acciones">
                <button type="button" className="cer-boton cer-boton-grande cer-boton-fuerte" onClick={() => onIr(0)}>
                  Empezar la ceremonia
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
                {!sinWebgl && (
                  <button
                    type="button"
                    className="cer-boton cer-boton-grande"
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
                  Arrastra para girar los anillos · toca una tarjeta para ir a su centro
                </p>
              )}
            </motion.footer>
          )}
        </AnimatePresence>
      </div>

      <div ref={chip} className="cer-a3d-chip" data-visible={hover ? "" : undefined} style={hover ? { ["--c-h" as string]: hover.matiz } : undefined}>
        {hover && (
          <>
            <b>{hover.ips}</b>
            <span>{hover.valor}</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </>
        )}
      </div>

      <nav className="sr-only" aria-label="Centros">
        {centros.map((c, i) => (
          <button key={c.ips} type="button" onClick={() => onIr(i)}>
            Ir a {c.ips}
          </button>
        ))}
      </nav>
    </div>
  );
}

/* ═════════════════════ Escena ═════════════════════ */

type Three = typeof import("three");
type ClaseAmbiente = typeof import("three/examples/jsm/environments/RoomEnvironment.js").RoomEnvironment;
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

/** Anillos: radio, altura y giro propio (rad/s) por valor. */
const ANILLOS = [
  { r: 3.35, y: 1.15, giro: 0.11 },
  { r: 4.45, y: 0.0, giro: -0.075 },
  { r: 5.55, y: -1.15, giro: 0.05 },
];
const CARTA = { w: 0.92, h: 1.28, d: 0.035 };
const MEDALLA_Y = 2.35;

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

function montar(THREE: Three, RoomEnvironment: ClaseAmbiente, el: HTMLDivElement, o: Opciones) {
  const fuente = getComputedStyle(el).fontFamily || "system-ui, sans-serif";
  const desechables: { dispose: () => void }[] = [];
  const guardar = <T extends { dispose: () => void }>(x: T) => {
    desechables.push(x);
    return x;
  };

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  el.appendChild(renderer.domElement);
  const anisotropia = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const scene = new THREE.Scene();
  const pmrem = guardar(new THREE.PMREMGenerator(renderer));
  const ambiente = guardar(pmrem.fromScene(new RoomEnvironment(), 0.03).texture);
  scene.environment = ambiente;
  scene.fog = new THREE.Fog(0xf1f5fb, 15, 34);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xdfe7f2, 0.9));
  const sol = new THREE.DirectionalLight(0xffffff, 1.4);
  sol.position.set(4, 9, 7);
  scene.add(sol);

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  const raiz = new THREE.Group();
  scene.add(raiz);

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

  /* ── Medalla ── */
  const oro = guardar(new THREE.MeshStandardMaterial({ color: 0xd9a63e, metalness: 1, roughness: 0.22 }));
  const caraMedalla = lienzo(512, 512, (ctx) => {
    const g = ctx.createRadialGradient(200, 170, 20, 256, 256, 260);
    g.addColorStop(0, "#fff4c9");
    g.addColorStop(0.55, "#e7b955");
    g.addColorStop(1, "#b07a20");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = "rgba(110,70,10,0.55)";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(256, 256, 226, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(256, 256, 206, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "rgba(120,78,12,0.85)";
    estrella(ctx, 256, 178, 62);
    ctx.fill();
    ctx.textAlign = "center";
    ctx.font = `800 104px ${fuente}`;
    ctx.fillText(String(o.anio), 256, 338);
    ctx.font = `800 30px ${fuente}`;
    ctx.fillText("GALARDONES", 256, 392);
  });
  const caraOro = guardar(new THREE.MeshStandardMaterial({ map: caraMedalla, metalness: 0.85, roughness: 0.3 }));
  const medalla = new THREE.Group();
  const disco = new THREE.Mesh(guardar(new THREE.CylinderGeometry(1.05, 1.05, 0.16, 96)), [oro, caraOro, caraOro]);
  disco.rotation.x = Math.PI / 2;
  const pivote = new THREE.Group();
  pivote.add(disco);
  medalla.add(pivote);
  const aro1 = new THREE.Mesh(guardar(new THREE.TorusGeometry(1.42, 0.035, 16, 160)), oro);
  const aro2 = new THREE.Mesh(guardar(new THREE.TorusGeometry(1.62, 0.02, 12, 160)), oro);
  medalla.add(aro1, aro2);
  const halo = new THREE.Sprite(
    guardar(
      new THREE.SpriteMaterial({
        map: lienzo(256, 256, (ctx) => {
          const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
          g.addColorStop(0, "rgba(255,214,120,0.75)");
          g.addColorStop(0.4, "rgba(255,214,120,0.25)");
          g.addColorStop(1, "rgba(255,214,120,0)");
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, 256, 256);
        }),
        transparent: true,
        depthWrite: false,
      }),
    ),
  );
  halo.scale.set(6, 6, 1);
  halo.position.z = -0.4;
  medalla.add(halo);
  medalla.position.y = MEDALLA_Y;
  raiz.add(medalla);

  /* ── Sombra de contacto ── */
  const sombra = new THREE.Mesh(
    guardar(new THREE.PlaneGeometry(16, 16)),
    guardar(
      new THREE.MeshBasicMaterial({
        map: lienzo(256, 256, (ctx) => {
          const g = ctx.createRadialGradient(128, 128, 30, 128, 128, 128);
          g.addColorStop(0, "rgba(30,45,80,0.2)");
          g.addColorStop(1, "rgba(30,45,80,0)");
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, 256, 256);
        }),
        transparent: true,
        depthWrite: false,
      }),
    ),
  );
  sombra.rotation.x = -Math.PI / 2;
  sombra.position.y = -2.25;
  raiz.add(sombra);

  /* ── Tarjetas ── */
  const geoCarta = guardar(new THREE.BoxGeometry(CARTA.w, CARTA.h, CARTA.d));
  type Carta = {
    mesh: InstanceType<Three["Mesh"]>;
    k: number;
    c: number;
    v: number;
    ips: string;
    valor: string;
    matiz: number;
    dispersa: InstanceType<Three["Vector3"]>;
    giroDisperso: InstanceType<Three["Quaternion"]>;
    retraso: number;
    hover: number;
  };
  const n = o.centros.length;
  const cartas: Carta[] = [];
  ORDEN_VALORES.forEach((clave, v) => {
    const info = valorInfo(clave);
    const tono = color(info.matiz);
    const lateral = guardar(new THREE.MeshStandardMaterial({ color: new THREE.Color().setStyle(color(info.matiz, 0.6, 0.13)), roughness: 0.5 }));
    const dorso = guardar(
      new THREE.MeshStandardMaterial({
        roughness: 0.55,
        map: lienzo(256, 356, (ctx) => {
          const g = ctx.createLinearGradient(0, 0, 256, 356);
          g.addColorStop(0, color(info.matiz, 0.62, 0.13));
          g.addColorStop(1, color(info.matiz, 0.46, 0.13));
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, 256, 356);
          ctx.strokeStyle = "rgba(255,255,255,0.35)";
          ctx.lineWidth = 3;
          redondeado(ctx, 14, 14, 228, 328, 16);
          ctx.stroke();
          ctx.fillStyle = "rgba(255,255,255,0.92)";
          estrella(ctx, 128, 150, 46);
          ctx.fill();
          ctx.textAlign = "center";
          ctx.font = `800 26px ${fuente}`;
          ctx.fillText(info.nombre.toUpperCase(), 128, 248);
        }),
      }),
    );
    o.centros.forEach((centro, c) => {
      const frente = guardar(
        new THREE.MeshStandardMaterial({
          roughness: 0.62,
          map: lienzo(256, 356, (ctx) => {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, 256, 356);
            ctx.fillStyle = tono;
            ctx.fillRect(0, 0, 256, 22);
            ctx.textAlign = "center";
            ctx.font = `800 19px ${fuente}`;
            ctx.fillText(`VALOR ${info.numero} · ${info.nombre.toUpperCase()}`, 128, 60);
            ctx.fillStyle = "#1b2540";
            let tam = 44;
            let lineas: string[] = [];
            for (;;) {
              ctx.font = `800 ${tam}px ${fuente}`;
              lineas = envolver(ctx, centro.ips, 216);
              const cabe = lineas.length <= 3 && lineas.every((l) => ctx.measureText(l).width <= 226);
              if (cabe || tam <= 22) break;
              tam -= 2;
            }
            const alto = tam * 1.12;
            const y0 = 190 - ((lineas.length - 1) * alto) / 2;
            lineas.forEach((l, i) => ctx.fillText(l, 128, y0 + i * alto));
            ctx.fillStyle = "#c9952f";
            estrella(ctx, 128, 296, 15);
            ctx.fill();
            ctx.fillStyle = "#7a849a";
            ctx.font = `700 15px ${fuente}`;
            ctx.fillText(`GALARDONES ${o.anio}`, 128, 333);
          }),
        }),
      );
      const mesh = new THREE.Mesh(geoCarta, [lateral, lateral, lateral, lateral, frente, dorso]);
      const k = cartas.length;
      const u = azar(k + 1) * Math.PI * 2;
      const w = Math.acos(2 * azar(k + 7) - 1);
      const rad = 4.5 + azar(k + 13) * 4.5;
      const dispersa = new THREE.Vector3(Math.sin(w) * Math.cos(u) * rad, Math.cos(w) * rad * 0.6 + 0.6, Math.sin(w) * Math.sin(u) * rad);
      const giroDisperso = new THREE.Quaternion().setFromEuler(new THREE.Euler((azar(k + 3) - 0.5) * 2.4, azar(k + 5) * Math.PI * 2, (azar(k + 9) - 0.5) * 1.6));
      mesh.userData.k = k;
      raiz.add(mesh);
      cartas.push({ mesh, k, c, v, ips: centro.ips, valor: info.nombre, matiz: info.matiz, dispersa, giroDisperso, retraso: azar(k + 21) * 0.5 + v * 0.18, hover: 0 });
    });
  });
  const mallas = cartas.map((x) => x.mesh);

  /* ── Polvo dorado ── */
  const P = 650;
  const pos = new Float32Array(P * 3);
  const col = new Float32Array(P * 3);
  const vel = new Float32Array(P);
  const paleta = [new THREE.Color(0xd9a63e), new THREE.Color(0xe8c26a), ...VALORES_GALARDON.map((v) => new THREE.Color().setStyle(color(v.matiz, 0.65, 0.14)))];
  for (let i = 0; i < P; i++) {
    const a = azar(i + 500) * Math.PI * 2;
    const r = 1.5 + Math.sqrt(azar(i + 900)) * 10;
    pos.set([Math.cos(a) * r, -3 + azar(i + 1300) * 10, Math.sin(a) * r], i * 3);
    const cc = i % 4 === 0 ? paleta[2 + (i % 3)] : paleta[i % 2];
    col.set([cc.r, cc.g, cc.b], i * 3);
    vel[i] = 0.15 + azar(i + 1700) * 0.45;
  }
  const geoPolvo = guardar(new THREE.BufferGeometry());
  geoPolvo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geoPolvo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const polvo = new THREE.Points(
    geoPolvo,
    guardar(
      new THREE.PointsMaterial({
        size: 0.085,
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        map: lienzo(64, 64, (ctx) => {
          const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
          g.addColorStop(0, "rgba(255,255,255,1)");
          g.addColorStop(0.35, "rgba(255,255,255,0.8)");
          g.addColorStop(1, "rgba(255,255,255,0)");
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, 64, 64);
        }),
      }),
    ),
  );
  scene.add(polvo);

  /* ── Encuadre ── */
  const objetivo = new THREE.Vector3();
  let distancia = 16;
  const encuadrar = () => {
    const w = el.clientWidth || 1;
    const h = el.clientHeight || 1;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    camera.aspect = w / h;
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    // Que quepan los anillos de lado a lado y, en alto, la medalla y el pie.
    distancia = Math.max(6.7 / (tan * camera.aspect), 5.6 / tan);
    objetivo.set(0, w < 700 ? 0.9 : 0.55, 0);
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
      if (k >= 0) o.alIr(cartas[k].c);
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
    const mov = o.reducir ? 0 : 1;

    if (!abajo) {
      arrastre += inercia * dt;
      inercia *= Math.pow(0.04, dt);
    }

    // Cámara: entra desde lejos y alto, luego respira con el puntero.
    const entrada = o.reducir ? 1 : suave(tramo(t, 0, FIN));
    const elev = THREE.MathUtils.lerp(0.62, 0.27, entrada);
    const d = distancia * THREE.MathUtils.lerp(1.35, 1, entrada);
    const px = ndc.x > 5 ? 0 : ndc.x * mov;
    const py = ndc.y > 5 ? 0 : ndc.y * mov;
    const az = px * 0.12;
    const el2 = elev + py * 0.05;
    camera.position.set(Math.sin(az) * Math.cos(el2) * d, objetivo.y + Math.sin(el2) * d, Math.cos(az) * Math.cos(el2) * d);
    camera.lookAt(objetivo);

    // Medalla
    const aparece = o.reducir ? 1 : salida(tramo(t, 0, 1.2));
    medalla.scale.setScalar(0.001 + aparece);
    medalla.position.y = MEDALLA_Y + Math.sin(t * 1.1) * 0.08 * mov;
    pivote.rotation.y = (1 - aparece) * Math.PI * 4 + Math.sin(t * 0.55) * 0.5 * mov;
    aro1.rotation.set(Math.sin(t * 0.4) * 0.9 * mov + 0.3, t * 0.5 * mov, 0);
    aro2.rotation.set(Math.cos(t * 0.3) * 0.8 * mov - 0.4, -t * 0.35 * mov, 0.5);

    // Hover (solo cuando ya están en sus anillos)
    const k = abajo || t < FIN * 0.8 ? -1 : tocada();
    if (k !== encima) {
      encima = k;
      canvas.style.cursor = k >= 0 ? "pointer" : "grab";
      o.alHover(k >= 0 ? { ips: cartas[k].ips, valor: cartas[k].valor, matiz: cartas[k].matiz } : null);
    }

    for (const x of cartas) {
      const a = ANILLOS[x.v];
      const sentido = x.v % 2 ? -1 : 1;
      const ang = (x.c / n) * Math.PI * 2 + a.giro * t * mov + arrastre * sentido * (1 - x.v * 0.15) + x.v * 0.4;
      x.hover += ((encima === x.k ? 1 : 0) - x.hover) * Math.min(1, dt * 12);
      const r = a.r + x.hover * 0.55;
      vFinal.set(Math.sin(ang) * r, a.y + x.hover * 0.12 + Math.sin(t * 1.3 + x.c) * 0.035 * mov, Math.cos(ang) * r);
      qFinal.setFromAxisAngle(ejeY, ang);

      // 1) estalla desde la medalla  2) flota  3) se ordena en su anillo
      const p1 = salida(tramo(t, 0.35 + x.retraso * 0.5, 1.9 + x.retraso * 0.5));
      const p2 = suave(tramo(t, 2.5 + x.retraso, 4.6 + x.retraso));
      vTmp.copy(x.dispersa);
      vTmp.y += Math.sin(t * 0.9 + x.retraso * 9) * 0.25 * mov;
      vTmp.lerpVectors(origen, vTmp, p1);
      x.mesh.position.lerpVectors(vTmp, vFinal, p2);
      qGiro.setFromAxisAngle(ejeY, t * 0.6 * mov);
      qTmp.copy(qGiro).multiply(x.giroDisperso);
      x.mesh.quaternion.slerpQuaternions(qTmp, qFinal, p2);
      x.mesh.scale.setScalar((0.001 + p1) * (1 + x.hover * 0.2));
    }

    // Polvo que sube
    if (mov) {
      for (let i = 0; i < P; i++) {
        pos[i * 3 + 1] += vel[i] * dt;
        if (pos[i * 3 + 1] > 7) pos[i * 3 + 1] = -3;
      }
      geoPolvo.attributes.position.needsUpdate = true;
      polvo.rotation.y += dt * 0.03;
    }

    // Etiqueta que sigue a la tarjeta
    const ch = o.chip();
    if (ch && encima >= 0) {
      vTmp.copy(cartas[encima].mesh.position).add(encimaCarta).project(camera);
      ch.style.transform = `translate(${((vTmp.x + 1) / 2) * el.clientWidth}px, ${((1 - vTmp.y) / 2) * el.clientHeight}px) translate(-50%, -100%)`;
    }

    if (!avisado && t >= FIN) {
      avisado = true;
      o.alListo();
    }
    renderer.render(scene, camera);
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
    renderer.dispose();
    canvas.remove();
  };
}
