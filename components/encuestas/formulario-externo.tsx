"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BedDouble,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  FlaskConical,
  HeartPulse,
  Loader2,
  MoreHorizontal,
  Pill,
  RotateCcw,
  Send,
  ShieldCheck,
  Siren,
  Smile,
  Stethoscope,
  Syringe,
  ThumbsDown,
  ThumbsUp,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { leerConfig, type ConfigPregunta, type OpcionPregunta, type TonoOpcion, type ValorRespuesta } from "@/lib/encuestas/tipos";
import type { EncuestaFormulario, PaginaFormulario, PreguntaFormulario } from "@/components/encuestas/formulario-encuesta";

/**
 * FORMULARIO DE CARA AL USUARIO EXTERNO (encuesta SIAU y cualquiera que
 * declare estilos de presentación en sus preguntas).
 *
 * Misma encuesta, mismas respuestas guardadas que el formulario estándar
 * del módulo, otra piel: cabecera institucional con código de formato,
 * stepper, tarjetas con icono por servicio, caritas con personalidad,
 * matriz de personal reordenada según el servicio elegido, auto-avance en
 * las preguntas de una sola elección y cierre con confeti. Pensado para
 * responderse en el teléfono en menos de tres minutos, por alguien que no
 * conoce la plataforma.
 */

export type InstitucionFormulario = { nombre: string; logoUrl: string | null };

type Respuestas = Record<string, ValorRespuesta>;

const ICONOS: Record<string, LucideIcon> = {
  Siren, BedDouble, Stethoscope, FlaskConical, Smile, HeartPulse, Syringe, Pill, UserRound, MoreHorizontal,
};

/** Colores por SIGNIFICADO de la opción (nunca por su posición). */
const TONO: Record<TonoOpcion, { color: string; suave: string; nombre: string }> = {
  exc: { color: "#1f9d5a", suave: "#e6f6ec", nombre: "Excelente" },
  bue: { color: "#2f80c2", suave: "#e8f1fa", nombre: "Bueno" },
  reg: { color: "#e0a11c", suave: "#fdf4dd", nombre: "Regular" },
  mal: { color: "#e0642e", suave: "#fdece4", nombre: "Malo" },
  muymal: { color: "#d64545", suave: "#fbe7e7", nombre: "Muy malo" },
  na: { color: "#64748b", suave: "#eef2f6", nombre: "No aplica" },
};

const MOTION_SUAVE = [0.22, 1, 0.36, 1] as const;

function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function tieneValor(v: ValorRespuesta | undefined): boolean {
  if (!v) return false;
  if (v.tipo === "texto") return v.texto.trim().length > 0;
  if (v.tipo === "fecha") return v.valor.trim().length > 0;
  if (v.tipo === "opciones") return v.opcionIds.length > 0;
  return true;
}

function textoElegido(pregunta: PreguntaFormulario | undefined, valor: ValorRespuesta | undefined): string | null {
  if (!pregunta || valor?.tipo !== "opcion") return null;
  return leerConfig(pregunta.config).opciones?.find((o) => o.id === valor.opcionId)?.texto ?? null;
}

// ================================================================ carita

/**
 * Carita con personalidad. La emoción sale del TONO de la opción, y la
 * animación de la selección también: Excelente salta con destellos, Bueno
 * asiente, Regular ladea la cabeza, Malo tiembla, Muy malo se descuelga con
 * una lágrima y No aplica parpadea en gris.
 */
function Carita({ tono, activa, tamano = 56 }: { tono: TonoOpcion; activa: boolean; tamano?: number }) {
  const reducir = useReducedMotion();
  const c = TONO[tono].color;

  const animacion = reducir || !activa
    ? {}
    : tono === "exc"
      ? { y: [0, -10, 0, -4, 0], scale: [1, 1.08, 1] }
      : tono === "bue"
        ? { rotate: [0, 0, 0], y: [0, 3, 0, 3, 0] }
        : tono === "reg"
          ? { rotate: [0, -10, 0] }
          : tono === "mal"
            ? { x: [0, -4, 4, -3, 3, 0] }
            : tono === "muymal"
              ? { y: [0, 6], rotate: [0, -4] }
              : { opacity: [1, 0.45, 1] };

  const boca =
    tono === "exc"
      ? "M17 34 Q28 46 39 34"
      : tono === "bue"
        ? "M19 35 Q28 42 37 35"
        : tono === "reg"
          ? "M19 37 L37 37"
          : tono === "mal"
            ? "M19 40 Q28 33 37 40"
            : tono === "muymal"
              ? "M18 41 Q28 31 38 41"
              : "M20 37 L36 37";

  return (
    <motion.svg
      viewBox="0 0 56 56"
      width={tamano}
      height={tamano}
      aria-hidden="true"
      animate={animacion}
      transition={{ duration: 0.7, ease: "easeOut" }}
      className="shrink-0"
    >
      <circle cx="28" cy="28" r="25" fill={activa ? c : TONO[tono].suave} stroke={c} strokeWidth="2.5" strokeDasharray={tono === "na" ? "4 3" : undefined} />
      {/* ojos */}
      {tono === "exc" ? (
        <>
          <path d="M17 24 Q21 19 25 24" stroke={activa ? "#fff" : c} strokeWidth="2.6" fill="none" strokeLinecap="round" />
          <path d="M31 24 Q35 19 39 24" stroke={activa ? "#fff" : c} strokeWidth="2.6" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="21" cy="23" r="2.6" fill={activa ? "#fff" : c} />
          <circle cx="35" cy="23" r="2.6" fill={activa ? "#fff" : c} />
        </>
      )}
      {tono === "mal" || tono === "muymal" ? (
        <>
          <path d="M16 18 L25 21" stroke={activa ? "#fff" : c} strokeWidth="2.2" strokeLinecap="round" />
          <path d="M40 18 L31 21" stroke={activa ? "#fff" : c} strokeWidth="2.2" strokeLinecap="round" />
        </>
      ) : null}
      <path d={boca} stroke={activa ? "#fff" : c} strokeWidth="2.8" fill="none" strokeLinecap="round" />
      {/* lágrima */}
      {tono === "muymal" && activa && !reducir && (
        <motion.path
          d="M38 29 q3 5 0 7 q-3 -2 0 -7"
          fill="#fff"
          initial={{ opacity: 0, y: 0 }}
          animate={{ opacity: [0, 1, 1, 0], y: [0, 4, 8, 12] }}
          transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 0.6 }}
        />
      )}
      {/* destellos */}
      {tono === "exc" && activa && !reducir && (
        <>
          <motion.path d="M47 8 l1.5 3 3 1.5 -3 1.5 -1.5 3 -1.5 -3 -3 -1.5 3 -1.5z" fill={c} initial={{ scale: 0, opacity: 0 }} animate={{ scale: [0, 1.2, 0], opacity: [0, 1, 0] }} transition={{ duration: 0.9, delay: 0.1 }} />
          <motion.path d="M8 12 l1 2 2 1 -2 1 -1 2 -1 -2 -2 -1 2 -1z" fill={c} initial={{ scale: 0, opacity: 0 }} animate={{ scale: [0, 1.2, 0], opacity: [0, 1, 0] }} transition={{ duration: 0.9, delay: 0.3 }} />
        </>
      )}
    </motion.svg>
  );
}

// ================================================================ confeti

function Confeti({ colores, activo }: { colores: string[]; activo: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reducir = useReducedMotion();
  useEffect(() => {
    if (!activo || reducir) return;
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    ctx.scale(dpr, dpr);
    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    const piezas = Array.from({ length: 70 }, () => ({
      x: W / 2 + (Math.random() - 0.5) * 120,
      y: H * 0.35,
      vx: (Math.random() - 0.5) * 9,
      vy: -Math.random() * 9 - 3,
      w: 6 + Math.random() * 6,
      h: 4 + Math.random() * 5,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      color: colores[Math.floor(Math.random() * colores.length)],
    }));
    const inicio = performance.now();
    let raf = 0;
    function cuadro(t: number) {
      const dt = (t - inicio) / 1000;
      ctx!.clearRect(0, 0, W, H);
      for (const p of piezas) {
        p.vy += 0.22;
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.99;
        p.rot += p.vr;
        ctx!.save();
        ctx!.translate(p.x, p.y);
        ctx!.rotate(p.rot);
        ctx!.globalAlpha = Math.max(0, 1 - dt / 5);
        ctx!.fillStyle = p.color;
        ctx!.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx!.restore();
      }
      if (dt < 5) raf = requestAnimationFrame(cuadro);
      else ctx!.clearRect(0, 0, W, H);
    }
    raf = requestAnimationFrame(cuadro);
    return () => cancelAnimationFrame(raf);
  }, [activo, colores, reducir]);
  return <canvas ref={ref} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" />;
}

// ================================================================ formulario

export function FormularioExterno({
  encuesta,
  codigo,
  institucion,
  onEnviar,
  modoKiosco = false,
}: {
  encuesta: EncuestaFormulario;
  /** Código del formato (PM-7-SIAU-PR-02 V.1) para la cabecera. */
  codigo: string;
  institucion: InstitucionFormulario;
  onEnviar: (respuestas: Respuestas, nombre: string | null) => Promise<string | null>;
  /** Tótem en sala: al terminar vuelve solo a la bienvenida. */
  modoKiosco?: boolean;
}) {
  const acento = encuesta.themeColor || "#0f8b8d";
  const claveSesion = `encuesta-${encuesta.id}`;
  const paginas = encuesta.pages;

  const [paso, setPaso] = useState(0);
  const [direccion, setDireccion] = useState(1);
  const [respuestas, setRespuestas] = useState<Respuestas>({});
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [rechazo, setRechazo] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [segundos, setSegundos] = useState<number | null>(null);
  const [enviando, startTransition] = useTransition();
  const inicioRef = useRef<number>(Date.now());
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Avance guardado en sessionStorage: recargar no borra lo respondido, y
  // cerrar la pestaña sí (no queda nada de otra persona en un tótem).
  useEffect(() => {
    try {
      const crudo = sessionStorage.getItem(claveSesion);
      if (crudo) {
        const g = JSON.parse(crudo) as { paso: number; respuestas: Respuestas; inicio: number };
        setRespuestas(g.respuestas ?? {});
        setPaso(Math.min(g.paso ?? 0, paginas.length - 1));
        inicioRef.current = g.inicio ?? Date.now();
      }
    } catch {
      /* sin avance guardado */
    }
  }, [claveSesion, paginas.length]);
  useEffect(() => {
    if (enviado || rechazo) return;
    try {
      sessionStorage.setItem(claveSesion, JSON.stringify({ paso, respuestas, inicio: inicioRef.current }));
    } catch {
      /* almacenamiento bloqueado */
    }
  }, [claveSesion, paso, respuestas, enviado, rechazo]);

  const pagina: PaginaFormulario | undefined = paginas[paso];
  const todasLasPreguntas = useMemo(() => paginas.flatMap((p) => p.questions), [paginas]);

  // La fecha nace con el día de hoy y se guarda aunque no se toque.
  useEffect(() => {
    const deFecha = todasLasPreguntas.filter((q) => leerConfig(q.config).rol === "fecha");
    if (deFecha.length === 0) return;
    setRespuestas((prev) => {
      let cambio = false;
      const sig = { ...prev };
      for (const q of deFecha) {
        if (!sig[q.id]) {
          sig[q.id] = { tipo: "fecha", valor: hoyISO() };
          cambio = true;
        }
      }
      return cambio ? sig : prev;
    });
  }, [todasLasPreguntas]);
  const preguntaServicio = useMemo(
    () => todasLasPreguntas.find((q) => leerConfig(q.config).estilo === "servicios"),
    [todasLasPreguntas]
  );
  const servicioElegido = textoElegido(preguntaServicio, preguntaServicio ? respuestas[preguntaServicio.id] : undefined);
  const preguntaNombre = todasLasPreguntas.find((q) => leerConfig(q.config).rol === "nombre");

  // Pasos que cuentan en el stepper: los que empiezan por "Pregunta".
  const pasosNumerados = useMemo(
    () => paginas.map((p, i) => ({ i, n: /^pregunta\s*(\d+)/i.exec(p.title)?.[1] ?? null })).filter((p) => p.n !== null),
    [paginas]
  );
  const esUltimo = paso === paginas.length - 1;
  const progreso = Math.round(((paso + 1) / paginas.length) * 100);

  const faltantes = useMemo(() => {
    if (!pagina) return [];
    return pagina.questions.filter((q) => q.isRequired && !tieneValor(respuestas[q.id])).map((q) => q.id);
  }, [pagina, respuestas]);

  const ir = useCallback(
    (nuevo: number, dir: number) => {
      setDireccion(dir);
      setPaso(Math.max(0, Math.min(paginas.length - 1, nuevo)));
      setError(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [paginas.length]
  );

  function responder(q: PreguntaFormulario, valor: ValorRespuesta) {
    setRespuestas((prev) => ({ ...prev, [q.id]: valor }));
    setError(null);
    const config = leerConfig(q.config);

    // Puerta de consentimiento: NO cierra sin guardar nada.
    if (config.estilo === "habeas" && valor.tipo === "opcion") {
      if (valor.opcionId === "no") {
        setRechazo(true);
        try {
          sessionStorage.removeItem(claveSesion);
        } catch {
          /* nada */
        }
        return;
      }
      if (temporizador.current) clearTimeout(temporizador.current);
      temporizador.current = setTimeout(() => ir(paso + 1, 1), 420);
      return;
    }

    // Auto-avance: 520 ms después de elegir, con aviso. Siempre queda "Anterior".
    if (config.autoAvanzar && valor.tipo === "opcion" && !esUltimo) {
      setAviso("Respuesta registrada");
      if (temporizador.current) clearTimeout(temporizador.current);
      temporizador.current = setTimeout(() => {
        setAviso(null);
        ir(paso + 1, 1);
      }, 520);
    }
  }

  function siguiente() {
    if (faltantes.length > 0) {
      setError("Falta una respuesta obligatoria en esta pantalla.");
      document.getElementById(`pregunta-${faltantes[0]}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (!esUltimo) {
      ir(paso + 1, 1);
      return;
    }
    startTransition(async () => {
      const nombre = preguntaNombre ? respuestas[preguntaNombre.id] : undefined;
      const problema = await onEnviar(respuestas, nombre?.tipo === "texto" ? nombre.texto.trim() || null : null);
      if (problema) {
        setError(problema);
        return;
      }
      setSegundos(Math.round((Date.now() - inicioRef.current) / 1000));
      setEnviado(true);
      try {
        sessionStorage.removeItem(claveSesion);
      } catch {
        /* nada */
      }
    });
  }

  function reiniciar() {
    setRespuestas({});
    setPaso(0);
    setDireccion(-1);
    setEnviado(false);
    setRechazo(false);
    setError(null);
    setSegundos(null);
    inicioRef.current = Date.now();
    try {
      sessionStorage.removeItem(claveSesion);
    } catch {
      /* nada */
    }
    window.scrollTo({ top: 0 });
  }

  // Modo kiosco: vuelve solo a la bienvenida a los 8 s del cierre.
  useEffect(() => {
    if (!modoKiosco || !(enviado || rechazo)) return;
    const t = setTimeout(reiniciar, 8000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modoKiosco, enviado, rechazo]);

  // ------------------------------------------------------------ cabecera
  const cabecera = (
    <header className="sticky top-0 z-30 border-b border-border/50 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5 sm:px-6">
        {institucion.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={institucion.logoUrl} alt="" className="h-10 w-10 rounded-xl object-contain" />
        ) : (
          <span className="grid h-10 w-10 place-items-center rounded-xl text-white" style={{ backgroundColor: acento }}>
            <HeartPulse className="h-5 w-5" aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate font-display text-[14px] font-extrabold leading-tight text-foreground">{institucion.nombre}</p>
          <p className="truncate text-[12px] text-muted-foreground">{encuesta.title}</p>
        </div>
        <div className="ml-auto hidden text-right text-[11px] leading-snug text-muted-foreground sm:block">
          <b className="block font-semibold text-foreground">{codigo}</b>
          Resolución 0256 de 2016
        </div>
      </div>
      <div className="h-1 w-full bg-muted">
        <motion.div
          className="h-full"
          style={{ backgroundImage: `linear-gradient(90deg, ${acento}, color-mix(in oklch, ${acento} 70%, black))` }}
          animate={{ width: `${enviado ? 100 : progreso}%` }}
          transition={{ duration: 0.45, ease: MOTION_SUAVE }}
        />
      </div>
    </header>
  );

  // ------------------------------------------------------------ cierres
  if (rechazo) {
    return (
      <MotionConfig reducedMotion="user">
        {cabecera}
        <main className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-muted text-muted-foreground">
              <ShieldCheck className="h-8 w-8" aria-hidden="true" />
            </span>
            <h1 className="mt-6 font-display text-2xl font-extrabold tracking-tight text-foreground">Entendido</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
              Respetamos su decisión. No se ha guardado ningún dato. Gracias por su visita a {institucion.nombre}.
            </p>
            <button
              type="button"
              onClick={reiniciar}
              className="mt-8 inline-flex items-center gap-2 rounded-xl border border-border/60 bg-card px-5 py-2.5 text-[13px] font-bold text-foreground"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Volver al inicio
            </button>
          </motion.div>
        </main>
      </MotionConfig>
    );
  }

  if (enviado) {
    const min = Math.floor((segundos ?? 0) / 60);
    const seg = (segundos ?? 0) % 60;
    return (
      <MotionConfig reducedMotion="user">
        {cabecera}
        <main className="relative mx-auto max-w-xl overflow-hidden px-4 py-16 text-center sm:px-6">
          <Confeti colores={[acento, "#1f9d5a", "#2f80c2", "#e0a11c", "#0d2a4c"]} activo />
          <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.45 }} className="relative">
            <span
              className="mx-auto grid h-24 w-24 place-items-center rounded-full"
              style={{ backgroundColor: `${acento}1a`, boxShadow: `0 24px 60px -24px ${acento}` }}
            >
              <svg viewBox="0 0 64 64" className="h-14 w-14" aria-hidden="true">
                <motion.circle cx="32" cy="32" r="27" fill="none" stroke={acento} strokeWidth="4" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.7, ease: MOTION_SUAVE }} />
                <motion.path d="M20 33 L29 41 L45 24" fill="none" stroke={acento} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, delay: 0.5, ease: MOTION_SUAVE }} />
              </svg>
            </span>
            <h1 className="mt-7 font-display text-3xl font-extrabold tracking-tight text-foreground">¡Gracias!</h1>
            <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-muted-foreground">
              {encuesta.thankYouMessage || "Su respuesta quedó registrada. Gracias por tomarse el tiempo."}
            </p>
            {segundos !== null && (
              <p className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-muted px-3.5 py-1.5 text-[12.5px] font-semibold text-muted-foreground">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                Completada en {min > 0 ? `${min} min ` : ""}{seg} s
              </p>
            )}
            <div className="mt-8">
              <button
                type="button"
                onClick={reiniciar}
                className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-[14px] font-bold text-white shadow-lg"
                style={{ backgroundColor: acento, boxShadow: `0 18px 40px -18px ${acento}` }}
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Nueva encuesta
              </button>
              {modoKiosco && <p className="mt-3 text-[12px] text-muted-foreground">Volverá al inicio en unos segundos…</p>}
            </div>
          </motion.div>
        </main>
      </MotionConfig>
    );
  }

  // ------------------------------------------------------------ paso
  const esBienvenida = paso === 0;
  const tituloPaso = pagina?.title ?? "";
  const numeroPaso = /^pregunta\s*(\d+)/i.exec(tituloPaso)?.[1] ?? null;

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-[#f7f9fb] pb-28">
        {cabecera}

        {/* Stepper de preguntas: círculos con check en las completadas. */}
        {pasosNumerados.length > 0 && (
          <nav aria-label="Progreso" className="mx-auto flex max-w-3xl items-center justify-center gap-1.5 px-4 pt-5 sm:gap-2">
            {pasosNumerados.map((p) => {
              const hecha = p.i < paso;
              const actual = p.i === paso;
              return (
                <span
                  key={p.i}
                  className={cn(
                    "grid h-7 w-7 place-items-center rounded-full text-[11px] font-extrabold transition-all sm:h-8 sm:w-8 sm:text-[12px]",
                    actual ? "text-white shadow-md" : hecha ? "text-white" : "bg-white text-muted-foreground ring-1 ring-border/70"
                  )}
                  style={actual ? { backgroundColor: acento, boxShadow: `0 8px 20px -8px ${acento}`, transform: "scale(1.12)" } : hecha ? { backgroundColor: `${acento}b3` } : undefined}
                  aria-current={actual ? "step" : undefined}
                >
                  {hecha ? <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" /> : p.n}
                </span>
              );
            })}
          </nav>
        )}

        <main className="mx-auto max-w-3xl px-4 pt-5 sm:px-6">
          <AnimatePresence mode="wait" custom={direccion}>
            <motion.section
              key={pagina?.id ?? paso}
              custom={direccion}
              initial={{ opacity: 0, x: 28 * direccion }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -28 * direccion }}
              transition={{ duration: 0.32, ease: MOTION_SUAVE }}
              className="rounded-3xl border border-border/60 bg-white p-5 shadow-[0_18px_50px_-30px_rgba(13,42,76,0.35)] sm:p-8"
            >
              {esBienvenida ? (
                <div className="text-center">
                  <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-white" style={{ backgroundColor: acento }}>
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    Encuesta confidencial
                  </span>
                  <h1 className="mt-4 font-display text-[clamp(1.5rem,4.5vw,2.1rem)] font-extrabold leading-tight tracking-tight text-foreground">
                    {encuesta.title}
                  </h1>
                  {encuesta.estimatedMinutes && (
                    <p className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                      Menos de {encuesta.estimatedMinutes} minutos
                    </p>
                  )}
                  {pagina?.description && (
                    <p className="mx-auto mt-5 max-w-xl text-[15.5px] leading-relaxed text-foreground/85">{pagina.description}</p>
                  )}
                </div>
              ) : (
                <div>
                  <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: acento }}>
                    <span className="h-px w-6" style={{ backgroundColor: acento }} />
                    {numeroPaso ? `Pregunta ${numeroPaso} de ${pasosNumerados.length}` : tituloPaso}
                  </p>
                  {numeroPaso ? (
                    pagina?.description && (
                      <h2 className="mt-2 font-display text-[clamp(1.1rem,3vw,1.4rem)] font-extrabold leading-snug tracking-tight text-foreground">
                        {pagina.description.replace(/^\d+:\s*/, "")}
                      </h2>
                    )
                  ) : (
                    <>
                      <h2 className="mt-2 font-display text-[clamp(1.1rem,3vw,1.4rem)] font-extrabold leading-snug tracking-tight text-foreground">
                        {tituloPaso}
                      </h2>
                      {pagina?.description && <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{pagina.description}</p>}
                    </>
                  )}
                </div>
              )}

              <div className={cn("space-y-6", esBienvenida ? "mt-8" : "mt-6")}>
                <CuerpoPagina
                  pagina={pagina}
                  respuestas={respuestas}
                  onResponder={responder}
                  acento={acento}
                  servicioElegido={servicioElegido}
                  faltantes={error ? faltantes : []}
                />
              </div>
            </motion.section>
          </AnimatePresence>

          {error && (
            <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
              {error}
            </motion.p>
          )}

          {/* Navegación */}
          <div className="mt-5 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => ir(paso - 1, -1)}
              disabled={paso === 0 || enviando}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-white px-4 py-2.5 text-[13px] font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Anterior
            </button>
            {leerConfig(pagina?.questions[0]?.config).estilo === "habeas" ? null : (
              <button
                type="button"
                onClick={siguiente}
                disabled={enviando}
                className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-[14px] font-bold text-white shadow-lg transition-transform hover:-translate-y-px disabled:pointer-events-none disabled:opacity-60"
                style={{ backgroundColor: acento, boxShadow: `0 18px 40px -18px ${acento}` }}
              >
                {enviando ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Enviando…
                  </>
                ) : esUltimo ? (
                  <>
                    <Send className="h-4 w-4" aria-hidden="true" />
                    Enviar encuesta
                  </>
                ) : (
                  <>
                    {esBienvenida ? "Comenzar" : "Siguiente"}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </>
                )}
              </button>
            )}
          </div>

          <p className="mt-8 text-center text-[11px] text-muted-foreground">
            {codigo} · {institucion.nombre} · Sus respuestas son confidenciales y se usan solo para evaluar la calidad del servicio.
          </p>
        </main>

        {/* Aviso de auto-avance */}
        <AnimatePresence>
          {aviso && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4"
            >
              <span className="inline-flex items-center gap-2 rounded-full bg-[#0d2a4c] px-4 py-2 text-[13px] font-semibold text-white shadow-xl">
                <CheckCircle2 className="h-4 w-4" style={{ color: "#7ee2b8" }} aria-hidden="true" />
                {aviso}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}

// ================================================================ cuerpo

function CuerpoPagina({
  pagina,
  respuestas,
  onResponder,
  acento,
  servicioElegido,
  faltantes,
}: {
  pagina: PaginaFormulario | undefined;
  respuestas: Respuestas;
  onResponder: (q: PreguntaFormulario, v: ValorRespuesta) => void;
  acento: string;
  servicioElegido: string | null;
  faltantes: string[];
}) {
  if (!pagina) return null;
  const preguntas = pagina.questions;
  const configs = preguntas.map((q) => leerConfig(q.config));

  // Bloque de datos: ficha en dos columnas.
  const esFicha = configs.some((c) => c.rol === "nombre" || c.rol === "telefono" || c.estilo === "sexo");
  if (esFicha) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {preguntas.map((q, i) => (
          <div key={q.id} className={cn(configs[i].estilo === "sexo" ? "sm:col-span-2" : undefined)}>
            <PreguntaExterna q={q} config={configs[i]} valor={respuestas[q.id]} onResponder={(v) => onResponder(q, v)} acento={acento} falta={faltantes.includes(q.id)} />
          </div>
        ))}
      </div>
    );
  }

  // Matriz de personal (P2): filas reordenadas por el servicio elegido.
  if (configs.some((c) => c.estilo === "matriz")) {
    return <MatrizPersonal preguntas={preguntas} respuestas={respuestas} onResponder={onResponder} servicioElegido={servicioElegido} acento={acento} />;
  }

  return (
    <>
      {preguntas.map((q, i) => {
        const c = configs[i];
        // "¿Cuál?" solo si en la pregunta anterior se eligió "Otro".
        if (c.rol === "otro") {
          const anterior = preguntas[i - 1];
          const texto = textoElegido(anterior, anterior ? respuestas[anterior.id] : undefined);
          if (!texto || !/^otro/i.test(texto)) return null;
        }
        return (
          <PreguntaExterna key={q.id} q={q} config={c} valor={respuestas[q.id]} onResponder={(v) => onResponder(q, v)} acento={acento} falta={faltantes.includes(q.id)} />
        );
      })}
    </>
  );
}

// ================================================================ pregunta

function PreguntaExterna({
  q,
  config,
  valor,
  onResponder,
  acento,
  falta,
}: {
  q: PreguntaFormulario;
  config: ConfigPregunta;
  valor: ValorRespuesta | undefined;
  onResponder: (v: ValorRespuesta) => void;
  acento: string;
  falta: boolean;
}) {
  const reducir = useReducedMotion();
  const elegida = valor?.tipo === "opcion" ? valor.opcionId : null;
  const opciones = config.opciones ?? [];
  const escalonado = (i: number) => (reducir ? {} : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { delay: i * 0.045, duration: 0.3, ease: MOTION_SUAVE } });
  const enunciado = q.prompt.replace(/^\d+:\s*/, "");
  const esEnunciadoLargo = /^\d+:/.test(q.prompt);

  const titulo = (
    <p
      id={`pregunta-${q.id}`}
      className={cn(
        "scroll-mt-28",
        esEnunciadoLargo
          ? "font-display text-[clamp(1.1rem,3vw,1.4rem)] font-extrabold leading-snug tracking-tight text-foreground"
          : "text-[13px] font-semibold text-foreground",
        falta && "text-destructive"
      )}
    >
      {enunciado}
      {q.isRequired && !esEnunciadoLargo && <span className="ml-1 text-destructive">*</span>}
    </p>
  );

  const campo = "h-11 w-full rounded-xl border border-border/70 bg-white px-4 text-[15px] outline-none transition-shadow focus:ring-2";
  const estiloFoco = { ["--tw-ring-color" as string]: `${acento}66` } as React.CSSProperties;

  switch (config.estilo) {
    case "habeas": {
      const si = opciones.find((o) => o.id === "si") ?? { id: "si", texto: "Sí autorizo" };
      const no = opciones.find((o) => o.id === "no") ?? { id: "no", texto: "NO autorizo" };
      return (
        <div className="rounded-2xl border border-border/60 bg-[#f7f9fb] p-5">
          <p className="flex items-start gap-2.5 text-[13.5px] leading-relaxed text-foreground/85">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" style={{ color: acento }} aria-hidden="true" />
            {q.prompt}
          </p>
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={() => onResponder({ tipo: "opcion", opcionId: si.id })}
              className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl text-[15px] font-bold text-white shadow-lg"
              style={{ backgroundColor: acento, boxShadow: `0 18px 40px -18px ${acento}` }}
            >
              <Check className="h-5 w-5" strokeWidth={3} aria-hidden="true" />
              {si.texto}
            </motion.button>
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={() => onResponder({ tipo: "opcion", opcionId: no.id })}
              className="inline-flex h-14 items-center justify-center rounded-2xl border border-border/70 bg-white text-[15px] font-bold text-muted-foreground transition-colors hover:text-foreground"
            >
              {no.texto}
            </motion.button>
          </div>
        </div>
      );
    }

    case "sexo":
      return (
        <div>
          {titulo}
          <div className="mt-2 grid grid-cols-2 gap-3" role="radiogroup" aria-label={q.prompt}>
            {opciones.map((o) => {
              const activo = elegida === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={activo}
                  onClick={() => onResponder({ tipo: "opcion", opcionId: o.id })}
                  className={cn("h-12 rounded-xl border text-[15px] font-bold transition-all", activo ? "border-transparent text-white shadow-md" : "border-border/70 bg-white text-foreground/80 hover:border-foreground/30")}
                  style={activo ? { backgroundColor: acento, boxShadow: `0 10px 24px -12px ${acento}` } : undefined}
                >
                  {o.texto === "M" ? "Masculino" : o.texto === "F" ? "Femenino" : o.texto}
                  <span className="ml-1.5 text-[11px] font-semibold opacity-70">({o.texto})</span>
                </button>
              );
            })}
          </div>
        </div>
      );

    case "selector":
      return (
        <div>
          {titulo}
          <div className="relative mt-2">
            <select
              value={elegida ?? ""}
              onChange={(e) => e.target.value && onResponder({ tipo: "opcion", opcionId: e.target.value })}
              className={cn(campo, "appearance-none pr-10")}
              style={estiloFoco}
            >
              <option value="">Seleccione…</option>
              {opciones.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.texto}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          </div>
        </div>
      );

    case "servicios":
      return (
        <div>
          {titulo}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3" role="radiogroup" aria-label={enunciado}>
            {opciones.map((o, i) => {
              const activo = elegida === o.id;
              const Icono = ICONOS[o.icono ?? ""] ?? MoreHorizontal;
              return (
                <motion.button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={activo}
                  {...escalonado(i)}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => onResponder({ tipo: "opcion", opcionId: o.id })}
                  className={cn(
                    "flex min-h-[96px] flex-col items-start justify-between rounded-2xl border p-3.5 text-left transition-all",
                    activo ? "border-transparent bg-white shadow-lg" : "border-border/60 bg-white hover:-translate-y-0.5 hover:border-foreground/25 hover:shadow-md"
                  )}
                  style={activo ? { boxShadow: `0 0 0 2px ${acento}, 0 16px 34px -18px ${acento}` } : undefined}
                >
                  <span className="grid h-10 w-10 place-items-center rounded-xl" style={{ backgroundColor: activo ? acento : `${acento}1a`, color: activo ? "#fff" : acento }}>
                    <Icono className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className={cn("mt-2 text-[13.5px] leading-snug", activo ? "font-bold text-foreground" : "font-semibold text-foreground/80")}>{o.texto}</span>
                </motion.button>
              );
            })}
          </div>
        </div>
      );

    case "caritas":
      return (
        <div>
          {titulo}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4" role="radiogroup" aria-label={enunciado}>
            {opciones.map((o, i) => {
              const activo = elegida === o.id;
              const tono = o.tono ?? "na";
              const t = TONO[tono];
              return (
                <motion.button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={activo}
                  aria-label={o.texto}
                  {...escalonado(i)}
                  whileHover={reducir ? undefined : { y: -3 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => onResponder({ tipo: "opcion", opcionId: o.id })}
                  className={cn("group flex flex-col items-center rounded-2xl border bg-white px-3 pb-4 pt-5 text-center transition-all", activo ? "border-transparent shadow-lg" : "border-border/60 hover:shadow-md")}
                  style={activo ? { boxShadow: `0 0 0 2px ${t.color}, 0 18px 40px -20px ${t.color}`, backgroundColor: t.suave } : undefined}
                >
                  <Carita tono={tono} activa={activo} />
                  <span className="mt-3 font-display text-[15px] font-extrabold" style={{ color: t.color }}>
                    {o.texto}
                  </span>
                  <span className="mt-0.5 h-0.5 w-8 rounded-full transition-all group-hover:w-12" style={{ backgroundColor: t.color, opacity: activo ? 1 : 0.35 }} aria-hidden="true" />
                  {o.ayuda && <span className="mt-2 text-[11.5px] leading-snug text-muted-foreground">{o.ayuda}</span>}
                </motion.button>
              );
            })}
          </div>
        </div>
      );

    case "tarjetas":
      return (
        <div>
          {titulo}
          <div className="mt-5 grid grid-cols-2 gap-3" role="radiogroup" aria-label={enunciado}>
            {opciones.map((o, i) => {
              const activo = elegida === o.id;
              const tono = o.tono ?? "na";
              const t = TONO[tono];
              const Icono = tono === "exc" || tono === "bue" ? ThumbsUp : tono === "mal" || tono === "muymal" ? ThumbsDown : tono === "reg" ? MoreHorizontal : Check;
              return (
                <motion.button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={activo}
                  {...escalonado(i)}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => onResponder({ tipo: "opcion", opcionId: o.id })}
                  className={cn("flex items-center gap-3 rounded-2xl border-2 bg-white px-4 py-3.5 text-left transition-all", activo ? "shadow-lg" : "hover:shadow-md")}
                  style={{ borderColor: activo ? t.color : `${t.color}55`, backgroundColor: activo ? t.suave : undefined }}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ backgroundColor: activo ? t.color : t.suave, color: activo ? "#fff" : t.color }}>
                    <Icono className={cn("h-4 w-4", tono === "muymal" && "rotate-12")} aria-hidden="true" />
                  </span>
                  <span className={cn("text-[14px] leading-snug", activo ? "font-bold text-foreground" : "font-semibold text-foreground/80")}>{o.texto}</span>
                </motion.button>
              );
            })}
          </div>
        </div>
      );

    case "semaforo":
      return (
        <div>
          {titulo}
          <div className="mt-5 space-y-3" role="radiogroup" aria-label={enunciado}>
            {opciones.map((o, i) => {
              const activo = elegida === o.id;
              const tono = o.tono ?? "na";
              const t = TONO[tono];
              return (
                <motion.button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={activo}
                  {...escalonado(i)}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => onResponder({ tipo: "opcion", opcionId: o.id })}
                  className={cn("flex w-full items-center gap-4 rounded-2xl border bg-white py-4 pl-5 pr-4 text-left transition-all", activo ? "shadow-lg" : "border-border/60 hover:shadow-md")}
                  style={{ borderLeft: `6px solid ${t.color}`, borderColor: activo ? t.color : undefined, backgroundColor: activo ? t.suave : undefined }}
                >
                  <Carita tono={tono} activa={activo} tamano={40} />
                  <span className={cn("flex-1 text-[14.5px] leading-snug", activo ? "font-bold text-foreground" : "font-semibold text-foreground/85")}>{o.texto}</span>
                  <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition-colors", activo ? "border-transparent" : "border-border")} style={activo ? { backgroundColor: t.color } : undefined}>
                    {activo && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} aria-hidden="true" />}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>
      );

    default:
      break;
  }

  // ---- campos de texto / fecha
  switch (q.type) {
    case "DATE": {
      const actual = valor?.tipo === "fecha" ? valor.valor : config.rol === "fecha" ? hoyISO() : "";
      return (
        <div>
          {titulo}
          <input type="date" value={actual} onChange={(e) => onResponder({ tipo: "fecha", valor: e.target.value })} className={cn(campo, "mt-2")} style={estiloFoco} />
        </div>
      );
    }
    case "SHORT_TEXT":
      return (
        <div>
          {titulo}
          <input
            type={config.rol === "telefono" ? "tel" : "text"}
            inputMode={config.rol === "telefono" ? "tel" : undefined}
            value={valor?.tipo === "texto" ? valor.texto : ""}
            onChange={(e) => onResponder({ tipo: "texto", texto: e.target.value })}
            placeholder={config.rol === "nombre" ? "Opcional" : config.rol === "telefono" ? "Opcional" : config.rol === "otro" ? "Escriba el servicio" : "Opcional"}
            className={cn(campo, "mt-2")}
            style={estiloFoco}
          />
        </div>
      );
    case "LONG_TEXT": {
      const texto = valor?.tipo === "texto" ? valor.texto : "";
      const tope = config.maxLen ?? 600;
      return (
        <div>
          {titulo}
          <textarea
            value={texto}
            maxLength={tope}
            onChange={(e) => onResponder({ tipo: "texto", texto: e.target.value })}
            placeholder="Cuéntenos qué podríamos hacer mejor (opcional)"
            rows={5}
            className="mt-4 w-full resize-y rounded-2xl border border-border/70 bg-white px-4 py-3 text-[15px] leading-relaxed outline-none transition-shadow focus:ring-2"
            style={estiloFoco}
          />
          <p className="mt-1.5 text-right text-[11.5px] tabular-nums text-muted-foreground">
            {texto.length} / {tope}
          </p>
        </div>
      );
    }
    default:
      return null;
  }
}

// ================================================================ matriz P2

function MatrizPersonal({
  preguntas,
  respuestas,
  onResponder,
  servicioElegido,
  acento,
}: {
  preguntas: PreguntaFormulario[];
  respuestas: Respuestas;
  onResponder: (q: PreguntaFormulario, v: ValorRespuesta) => void;
  servicioElegido: string | null;
  acento: string;
}) {
  const [verOtros, setVerOtros] = useState(false);
  const filas = preguntas.map((q) => ({ q, c: leerConfig(q.config) }));
  const delServicio = filas.filter((f) => servicioElegido && f.c.servicios?.includes(servicioElegido));
  const transversales = filas.filter((f) => f.c.transversal);
  const resto = filas.filter((f) => !delServicio.includes(f) && !transversales.includes(f));
  // Sin servicio conocido, todas visibles en el orden del formato.
  const principales = servicioElegido ? [...delServicio, ...transversales] : filas;
  const plegadas = servicioElegido ? resto : [];
  const calificados = filas.filter((f) => tieneValor(respuestas[f.q.id])).length;

  const fila = (f: { q: PreguntaFormulario; c: ConfigPregunta }, destacada: boolean) => {
    const elegida = respuestas[f.q.id]?.tipo === "opcion" ? (respuestas[f.q.id] as { opcionId: string }).opcionId : null;
    return (
      <div key={f.q.id} id={`pregunta-${f.q.id}`} className={cn("rounded-2xl border p-3.5", destacada ? "bg-white" : "border-border/60 bg-white")} style={destacada ? { borderColor: `${acento}66` } : undefined}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[14px] font-bold text-foreground">{f.q.prompt}</p>
          {destacada && servicioElegido && (
            <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide" style={{ backgroundColor: `${acento}1a`, color: acento }}>
              Lo atendió hoy
            </span>
          )}
        </div>
        <div className="mt-2.5 grid grid-cols-5 gap-1.5" role="radiogroup" aria-label={f.q.prompt}>
          {(f.c.opciones ?? []).map((o) => {
            const activo = elegida === o.id;
            const t = TONO[o.tono ?? "na"];
            return (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={activo}
                aria-label={o.texto}
                onClick={() => onResponder(f.q, { tipo: "opcion", opcionId: o.id })}
                className={cn("flex flex-col items-center rounded-xl border px-1 py-1.5 transition-all", activo ? "border-transparent shadow-md" : "border-border/60 hover:border-foreground/25")}
                style={activo ? { backgroundColor: t.suave, boxShadow: `0 0 0 2px ${t.color}` } : undefined}
              >
                <Carita tono={o.tono ?? "na"} activa={activo} tamano={26} />
                <span className="mt-1 text-[10px] font-bold leading-none" style={{ color: t.color }}>
                  {o.id === "NA" ? "N/A" : o.texto}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#f7f9fb] px-4 py-3 text-[12.5px] text-muted-foreground">
        <span>
          <b className="text-foreground">¿Cómo responder?</b> Califique solo al personal que lo atendió; marque <b>N/A</b> si no aplica.
        </span>
        <span className="rounded-full bg-white px-2.5 py-1 text-[11.5px] font-bold tabular-nums" style={{ color: acento }}>
          {calificados} de {filas.length} calificados
        </span>
      </div>
      {principales.map((f) => fila(f, Boolean(servicioElegido && delServicio.includes(f))))}
      {plegadas.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setVerOtros((v) => !v)}
            className="flex w-full items-center justify-between rounded-2xl border border-dashed border-border/70 bg-white px-4 py-3 text-[13px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
            aria-expanded={verOtros}
          >
            Otro personal que lo atendió ({plegadas.length})
            <ChevronDown className={cn("h-4 w-4 transition-transform", verOtros && "rotate-180")} aria-hidden="true" />
          </button>
          <AnimatePresence initial={false}>
            {verOtros && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28 }} className="space-y-3 overflow-hidden pt-3">
                {plegadas.map((f) => fila(f, false))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

export { TONO as TONOS_EXTERNO };
export type { OpcionPregunta as OpcionExterna };
