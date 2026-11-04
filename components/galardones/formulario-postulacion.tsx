"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, Building2, Check, ChevronDown, HandHeart, Loader2, Search, Send, ShieldCheck, Sparkles, UserCheck, Users, X } from "lucide-react";
import type { GalardonValor } from "@prisma/client";
import { toast } from "sonner";
import { IPS_GALARDONES, nombreCentro, tipoCentro, type IpsGalardon } from "@/lib/galardones/ips";
import { VALORES_GALARDON } from "@/lib/galardones/valores";
import { buscarPersonas, enviarPostulacion, type PersonaDirectorio } from "@/app/galardones/acciones";
import { SIGNATURE_EASE } from "@/lib/motion";

const ICONOS: Record<GalardonValor, typeof ShieldCheck> = { INTEGRIDAD: ShieldCheck, HUMANIZACION: HandHeart, LIDERAZGO: Users };

/** Frases para arrancar a escribir: ayudan a describir una situación concreta, no un elogio genérico. */
const FRASES: Record<GalardonValor, string[]> = {
  INTEGRIDAD: ["Cumplió su palabra cuando ", "Cuidó los recursos al ", "Actuó con transparencia en ", "Reconoció un error y "],
  HUMANIZACION: ["Atendió con paciencia a ", "Escuchó y apoyó a ", "Trató con calidez a ", "Se puso en el lugar de "],
  LIDERAZGO: ["Propuso una solución para ", "Motivó al equipo a ", "Acompañó a un compañero en ", "Dio ejemplo cuando "],
};

type Entrada = { nombre: string; userId: string | null; motivo: string; detalle?: string | null };
type Entradas = Record<GalardonValor, Entrada>;
const VACIA: Entrada = { nombre: "", userId: null, motivo: "" };
const MIN_MOTIVO = 15;
const CLAVE_BORRADOR = "galardones-borrador-v1";
const ETIQUETAS = ["Centro IPS", ...VALORES_GALARDON.map((v) => v.nombre), "Confirmar"];

const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const iniciales = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
const vibrar = () => {
  try {
    navigator.vibrate?.(8);
  } catch {
    /* sin vibración */
  }
};

type Borrador = { ips: IpsGalardon | null; entradas: Entradas; indice: number };
function leerBorrador(): Borrador | null {
  try {
    const b = JSON.parse(localStorage.getItem(CLAVE_BORRADOR) ?? "null") as Borrador | null;
    if (!b?.entradas) return null;
    const algo = !!b.ips || VALORES_GALARDON.some((v) => b.entradas[v.clave]?.nombre || b.entradas[v.clave]?.motivo);
    return algo ? b : null;
  } catch {
    return null;
  }
}
const sinSuscripcion = () => () => {};

/**
 * Postulación por pasos: centro IPS → un valor por pantalla → confirmación.
 * Un paso por valor a propósito: la definición del valor se lee completa
 * antes de escribir el nombre, que es lo que pide el memorando (postular por
 * comportamientos observables, no por simpatía).
 *
 * Pensado primero para el celular: progreso compacto, acciones pegadas
 * abajo al alcance del pulgar, buscador de centros, frases para arrancar a
 * escribir y un borrador en el teléfono por si la persona cambia de app.
 */
export function FormularioPostulacion({ nombreVotante, ipsSugerida, cierraEl }: { nombreVotante: string; ipsSugerida: IpsGalardon | null; cierraEl: string | null }) {
  const router = useRouter();
  const reducir = useReducedMotion();
  const raiz = useRef<HTMLElement>(null);
  const [indice, setIndice] = useState(0);
  const [dir, setDir] = useState(1);
  const [ips, setIps] = useState<IpsGalardon | null>(ipsSugerida);
  const [entradas, setEntradas] = useState<Entradas>({ INTEGRIDAD: VACIA, HUMANIZACION: VACIA, LIDERAZGO: VACIA });
  const [error, setError] = useState<string | null>(null);
  const [enviando, startEnvio] = useTransition();
  const [celebrar, setCelebrar] = useState(false);
  const [borradorDescartado, setBorradorDescartado] = useState(false);
  const [tocado, setTocado] = useState(false);

  // El borrador solo existe en el navegador: se lee después de montar.
  const montado = useSyncExternalStore(sinSuscripcion, () => true, () => false);
  const borrador = useMemo(() => (montado && !tocado && !borradorDescartado ? leerBorrador() : null), [montado, tocado, borradorDescartado]);

  // Guardar el borrador mientras se escribe (solo cuando la persona ya tocó algo).
  useEffect(() => {
    if (!tocado) return;
    try {
      localStorage.setItem(CLAVE_BORRADOR, JSON.stringify({ ips, entradas, indice } satisfies Borrador));
    } catch {
      /* almacenamiento no disponible */
    }
  }, [tocado, ips, entradas, indice]);

  const valorActual = indice >= 1 && indice <= 3 ? VALORES_GALARDON[indice - 1] : null;
  const matizActual = valorActual?.matiz ?? (indice === 4 ? 85 : 225);
  const entradaCompleta = (e: Entrada) => e.nombre.trim().length >= 3 && e.motivo.trim().length >= MIN_MOTIVO;
  const puedeAvanzar = indice === 0 ? !!ips : valorActual ? entradaCompleta(entradas[valorActual.clave]) : true;
  const todoListo = !!ips && VALORES_GALARDON.every((v) => entradaCompleta(entradas[v.clave]));
  const hechos = [!!ips, ...VALORES_GALARDON.map((v) => entradaCompleta(entradas[v.clave])), false];

  const irA = (i: number) => {
    setError(null);
    setDir(i > indice ? 1 : -1);
    setIndice(i);
    vibrar();
    const top = (raiz.current?.getBoundingClientRect().top ?? 0) + window.scrollY - 12;
    window.scrollTo({ top: Math.max(0, top), behavior: reducir ? "auto" : "smooth" });
  };

  const recuperar = (b: Borrador) => {
    setTocado(true);
    setIps(b.ips);
    setEntradas({ ...{ INTEGRIDAD: VACIA, HUMANIZACION: VACIA, LIDERAZGO: VACIA }, ...b.entradas });
    setIndice(Math.min(Math.max(b.indice ?? 0, 0), 4));
  };
  const descartar = () => {
    try {
      localStorage.removeItem(CLAVE_BORRADOR);
    } catch {
      /* nada */
    }
    setBorradorDescartado(true);
  };

  const enviar = () => {
    if (!ips || !todoListo) return;
    setError(null);
    startEnvio(async () => {
      const r = await enviarPostulacion({
        ips,
        postulaciones: VALORES_GALARDON.map((v) => ({
          valor: v.clave,
          nombre: entradas[v.clave].nombre.trim(),
          userId: entradas[v.clave].userId,
          motivo: entradas[v.clave].motivo.trim(),
        })),
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      try {
        localStorage.removeItem(CLAVE_BORRADOR);
      } catch {
        /* nada */
      }
      vibrar();
      setCelebrar(true);
      toast.success("Postulación registrada. ¡Gracias por reconocer a tus compañeros!");
      setTimeout(() => router.refresh(), reducir ? 0 : 1400);
    });
  };

  const variantes = {
    entra: (d: number) => (reducir ? { opacity: 0 } : { opacity: 0, x: d * 42, filter: "blur(6px)" }),
    centro: { opacity: 1, x: 0, filter: "blur(0px)", transition: { duration: 0.45, ease: SIGNATURE_EASE } },
    sale: (d: number) => (reducir ? { opacity: 0 } : { opacity: 0, x: d * -42, filter: "blur(6px)", transition: { duration: 0.22 } }),
  };

  // Acciones de cada paso, en la barra pegada abajo.
  const hayAtras = indice > 0;
  const textoAccion = indice === 0 ? "Continuar" : valorActual ? (indice === 3 ? "Revisar" : "Siguiente valor") : enviando ? "Enviando…" : "Enviar postulación";
  const accionBloqueada = indice === 0 ? !ips : valorActual ? !puedeAvanzar : !todoListo || enviando;
  const IconoAccion = indice === 4 ? (enviando ? Loader2 : Send) : ArrowRight;
  const alAvanzar = () => (indice === 4 ? enviar() : irA(indice + 1));
  const alRetroceder = () => irA(indice === 4 ? 3 : indice - 1);

  const radio = 21;
  const circ = 2 * Math.PI * radio;

  return (
    <section ref={raiz} className="mt-6 scroll-mt-4" style={{ ["--g-h" as string]: matizActual }} aria-label="Formulario de postulación">
      {borrador && (
        <motion.div className="gala-borrador" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <span>
            Tienes una postulación a medias{borrador.ips ? ` para ${nombreCentro(borrador.ips)}` : ""} guardada en este dispositivo.
          </span>
          <button type="button" className="gala-btn gala-btn-principal gala-btn-mini" onClick={() => recuperar(borrador)}>
            Continuar donde quedé
          </button>
          <button type="button" className="gala-btn gala-btn-sutil gala-btn-mini" onClick={descartar}>
            Empezar de nuevo
          </button>
        </motion.div>
      )}

      {/* Progreso compacto (celular) */}
      <div className="gala-progreso" aria-hidden="true">
        <div className="gala-anillo">
          <svg viewBox="0 0 50 50">
            <circle className="pista" cx="25" cy="25" r={radio} />
            <circle className="relleno" cx="25" cy="25" r={radio} strokeDasharray={circ} strokeDashoffset={circ * (1 - (indice + 1) / 5)} />
          </svg>
          <b>{indice + 1}/5</b>
        </div>
        <div className="gala-progreso-texto">
          <small>{indice === 0 ? "Inicio" : indice === 4 ? "Final" : `Valor ${indice} de 3`}</small>
          <strong>{ETIQUETAS[indice]}</strong>
          <div className="gala-segmentos">
            {ETIQUETAS.map((e, i) => (
              <i key={e} data-on={i <= indice || hechos[i] || undefined} />
            ))}
          </div>
        </div>
      </div>

      {/* Riel (escritorio) */}
      <nav className="gala-riel" aria-label="Pasos">
        {ETIQUETAS.map((etiqueta, i) => {
          const estado = i === indice ? "activo" : i < indice ? "hecho" : "pendiente";
          const habilitado = i < indice || (i === indice + 1 && puedeAvanzar) || (i === 4 && todoListo);
          return (
            <button key={etiqueta} type="button" data-estado={estado} disabled={!habilitado && i !== indice} onClick={() => irA(i)} aria-current={i === indice ? "step" : undefined}>
              <span>{i === 0 ? "Inicio" : i === 4 ? "Final" : `Valor ${i}`}</span>
              <span style={{ fontSize: "0.78rem", letterSpacing: 0, textTransform: "none", fontWeight: 700 }}>{etiqueta}</span>
            </button>
          );
        })}
      </nav>

      <AnimatePresence mode="wait" custom={dir} initial={false}>
        {indice === 0 && (
          <motion.div key="ips" custom={dir} variants={variantes} initial="entra" animate="centro" exit="sale" className="gala-panel gala-panel-borde gala-valor">
            <PasoIps
              nombreVotante={nombreVotante}
              ipsSugerida={ipsSugerida}
              ips={ips}
              onElegir={(x) => {
                setTocado(true);
                setIps(x);
                vibrar();
              }}
            />
          </motion.div>
        )}

        {valorActual && (
          <motion.div
            key={valorActual.clave}
            custom={dir}
            variants={variantes}
            initial="entra"
            animate="centro"
            exit="sale"
            className="gala-panel gala-panel-borde gala-valor"
            style={{ ["--g-h" as string]: valorActual.matiz }}
          >
            <PasoValor
              indice={indice}
              valor={valorActual}
              entrada={entradas[valorActual.clave]}
              onChange={(e) => {
                setTocado(true);
                setEntradas((prev) => ({ ...prev, [valorActual.clave]: e }));
              }}
            />
          </motion.div>
        )}

        {indice === 4 && (
          <motion.div key="fin" custom={dir} variants={variantes} initial="entra" animate="centro" exit="sale" className="gala-panel gala-panel-borde gala-valor">
            <div className="gala-valor-halo" />
            <div className="gala-valor-cab">
              <span className="gala-valor-icono">
                <Sparkles className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <span className="gala-mono" data-tono="a">
                  Paso 5 de 5 · {ips ? nombreCentro(ips) : ""}
                </span>
                <h2>
                  Revisa y <em>confirma</em>
                </h2>
              </div>
            </div>
            <p className="gala-definicion">Una vez enviada, la postulación no se puede modificar. Verifica los nombres antes de confirmar.</p>
            <div className="gala-resumen">
              {VALORES_GALARDON.map((v, n) => {
                const e = entradas[v.clave];
                return (
                  <motion.div
                    key={v.clave}
                    className="gala-resumen-fila"
                    style={{ ["--g-h" as string]: v.matiz }}
                    initial={reducir ? false : { opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.08 * n, duration: 0.4, ease: SIGNATURE_EASE }}
                  >
                    <span className="gala-mono">
                      {v.numero}. {v.nombre}
                    </span>
                    <div>
                      <b>
                        {e.nombre}
                        {e.userId ? (
                          <span className="gala-vinculo ml-2 align-middle">
                            <UserCheck className="h-3 w-3" aria-hidden="true" /> En el campus
                          </span>
                        ) : null}
                      </b>
                      <p>{e.motivo}</p>
                    </div>
                    <button type="button" className="gala-btn gala-btn-sutil gala-btn-mini" onClick={() => irA(v.numero)}>
                      Editar
                    </button>
                  </motion.div>
                );
              })}
            </div>
            {error && (
              <p className="gala-error" role="alert">
                {error}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="gala-navegacion">
        {hayAtras ? (
          <button type="button" className="gala-btn gala-btn-sutil" onClick={alRetroceder} aria-label="Paso anterior">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Atrás</span>
          </button>
        ) : (
          <span className="gala-navegacion-ayuda">{cierraEl ? <>Plazo: hasta el <b>{cierraEl}</b></> : "Una sola postulación por colaborador"}</span>
        )}
        <motion.button
          type="button"
          className="gala-btn gala-btn-principal"
          disabled={accionBloqueada}
          onClick={alAvanzar}
          whileTap={reducir ? undefined : { scale: 0.97 }}
          animate={!accionBloqueada && !reducir ? { boxShadow: ["0 16px 34px -18px var(--g-a)", "0 16px 44px -12px var(--g-a)", "0 16px 34px -18px var(--g-a)"] } : undefined}
          transition={{ duration: 2.2, repeat: Infinity }}
        >
          {textoAccion}
          <IconoAccion className={`h-4 w-4 ${enviando && indice === 4 ? "animate-spin" : ""}`} aria-hidden="true" />
        </motion.button>
      </div>

      {celebrar && !reducir && <Confeti />}
    </section>
  );
}

/* ───────────── Paso 1: centro IPS ───────────── */

function PasoIps({ nombreVotante, ipsSugerida, ips, onElegir }: { nombreVotante: string; ipsSugerida: IpsGalardon | null; ips: IpsGalardon | null; onElegir: (x: IpsGalardon) => void }) {
  const [filtro, setFiltro] = useState("");
  const reducir = useReducedMotion();
  const lista = useMemo(() => {
    const orden = ipsSugerida ? [ipsSugerida, ...IPS_GALARDONES.filter((x) => x !== ipsSugerida)] : [...IPS_GALARDONES];
    const f = sinTildes(filtro.trim());
    return f ? orden.filter((x) => sinTildes(nombreCentro(x)).includes(f)) : orden;
  }, [filtro, ipsSugerida]);

  return (
    <>
      <div className="gala-valor-halo" />
      <div className="gala-valor-cab">
        <span className="gala-valor-icono">
          <Building2 className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <span className="gala-mono" data-tono="a">
            Paso 1 de 5
          </span>
          <h2>
            ¿En qué <em>centro</em> trabajas?
          </h2>
        </div>
      </div>
      <p className="gala-definicion">
        Hola, {nombreVotante.split(" ")[0]}. Las personas que postules deben ser de tu mismo centro: el reconocimiento se entrega por centro y por valor.
      </p>
      <label className="gala-buscar">
        <Search aria-hidden="true" />
        <input className="gala-input" placeholder="Buscar tu centro…" value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="Buscar centro IPS" />
      </label>
      <motion.div layout={!reducir} className="gala-ips" role="radiogroup" aria-label="Centro IPS">
        {lista.map((nombre, i) => (
          <motion.button
            layout={!reducir}
            key={nombre}
            type="button"
            role="radio"
            aria-checked={ips === nombre}
            data-activo={ips === nombre || undefined}
            data-sugerida={(nombre === ipsSugerida && ips !== nombre) || undefined}
            onClick={() => onElegir(nombre)}
            initial={reducir ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.02, 0.3), duration: 0.35, ease: SIGNATURE_EASE }}
            whileTap={reducir ? undefined : { scale: 0.96 }}
          >
            {nombreCentro(nombre)}
            <small>{nombre === ipsSugerida ? "Tu municipio" : tipoCentro(nombre)}</small>
            <AnimatePresence>
              {ips === nombre && (
                <motion.span className="gala-marca-ok" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: "spring", stiffness: 500, damping: 24 }}>
                  <Check className="h-3 w-3" aria-hidden="true" />
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        ))}
        {lista.length === 0 && <p className="gala-ips-vacio">Ningún centro coincide con «{filtro}».</p>}
      </motion.div>
    </>
  );
}

/* ───────────── Pasos 2 a 4: un valor ───────────── */

function PasoValor({ indice, valor, entrada, onChange }: { indice: number; valor: (typeof VALORES_GALARDON)[number]; entrada: Entrada; onChange: (e: Entrada) => void }) {
  const Icono = ICONOS[valor.clave];
  const reducir = useReducedMotion();
  const [sugerencias, setSugerencias] = useState<PersonaDirectorio[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [resaltada, setResaltada] = useState(0);
  const ultimaBusqueda = useRef(0);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const motivoRef = useRef<HTMLTextAreaElement>(null);
  const nombreRef = useRef<HTMLInputElement>(null);
  useEffect(
    () => () => {
      if (temporizador.current) clearTimeout(temporizador.current);
      ultimaBusqueda.current++;
    },
    [],
  );

  // Autocompletar del directorio con un pequeño retardo: se consulta al
  // dejar de escribir, no en cada tecla.
  const escribirNombre = (texto: string) => {
    onChange({ ...entrada, nombre: texto, userId: null, detalle: null });
    if (temporizador.current) clearTimeout(temporizador.current);
    const q = texto.trim();
    const marca = ++ultimaBusqueda.current;
    if (q.length < 3) {
      setSugerencias([]);
      setBuscando(false);
      return;
    }
    setBuscando(true);
    temporizador.current = setTimeout(async () => {
      try {
        const r = await buscarPersonas(q);
        if (marca === ultimaBusqueda.current) {
          setSugerencias(r);
          setResaltada(0);
          setAbierto(true);
        }
      } finally {
        if (marca === ultimaBusqueda.current) setBuscando(false);
      }
    }, 260);
  };

  const elegir = (p: PersonaDirectorio) => {
    if (temporizador.current) clearTimeout(temporizador.current);
    ultimaBusqueda.current++;
    setBuscando(false);
    onChange({ ...entrada, nombre: p.nombre, userId: p.id, detalle: [p.cargo, p.municipio].filter(Boolean).join(" · ") || null });
    setAbierto(false);
    setSugerencias([]);
    vibrar();
    setTimeout(() => motivoRef.current?.focus(), 60);
  };

  const quitarElegida = () => {
    onChange({ ...entrada, nombre: "", userId: null, detalle: null });
    setTimeout(() => nombreRef.current?.focus(), 30);
  };

  const usarFrase = (f: string) => {
    const actual = entrada.motivo.trimEnd();
    const nuevo = actual ? `${actual}${/[.!?]$/.test(actual) ? " " : ". "}${f}` : f;
    onChange({ ...entrada, motivo: nuevo.slice(0, 600) });
    vibrar();
    setTimeout(() => {
      const t = motivoRef.current;
      if (!t) return;
      t.focus();
      t.setSelectionRange(t.value.length, t.value.length);
    }, 20);
  };

  const largo = entrada.motivo.trim().length;
  const faltan = Math.max(0, MIN_MOTIVO - largo);
  const r = 7;
  const c = 2 * Math.PI * r;

  return (
    <>
      <div className="gala-valor-halo" />
      <span className="gala-valor-num" aria-hidden="true">
        0{valor.numero}
      </span>
      <div className="gala-valor-cab">
        <motion.span
          className="gala-valor-icono"
          initial={reducir ? false : { rotate: -12, scale: 0.8 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 16 }}
        >
          <Icono className="h-5 w-5" aria-hidden="true" />
        </motion.span>
        <div>
          <span className="gala-mono" data-tono="a">
            Paso {indice + 1} de 5 · Categoría {valor.numero}
          </span>
          <h2>
            <em>{valor.nombre}</em>
          </h2>
        </div>
      </div>
      <p className="gala-definicion">{valor.definicion}</p>
      <details className="gala-detalle">
        <summary>
          ¿Cómo se ve este valor en el día a día?
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        </summary>
        <p>{valor.comportamientos}</p>
      </details>

      <div className="gala-campo">
        <label htmlFor={`nombre-${valor.clave}`}>¿A quién postulas por {valor.nombre.toLowerCase()}?</label>
        <AnimatePresence mode="wait" initial={false}>
          {entrada.userId ? (
            <motion.div key="elegida" className="gala-elegida" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}>
              <span className="gala-avatar" aria-hidden="true">
                {iniciales(entrada.nombre)}
              </span>
              <span className="min-w-0">
                <b>{entrada.nombre}</b>
                <small>{entrada.detalle ?? "Registrado en el campus"}</small>
              </span>
              <button type="button" onClick={quitarElegida} aria-label={`Cambiar a ${entrada.nombre}`}>
                <X className="inline h-3.5 w-3.5" aria-hidden="true" /> Cambiar
              </button>
            </motion.div>
          ) : (
            <motion.div key="campo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative">
              <input
                ref={nombreRef}
                id={`nombre-${valor.clave}`}
                className="gala-input"
                placeholder="Nombre y apellidos de la persona"
                autoComplete="off"
                autoCapitalize="words"
                enterKeyHint="next"
                value={entrada.nombre}
                onChange={(e) => escribirNombre(e.target.value)}
                onFocus={() => sugerencias.length && setAbierto(true)}
                onBlur={() => setTimeout(() => setAbierto(false), 150)}
                onKeyDown={(e) => {
                  if (!abierto || !sugerencias.length) {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      motivoRef.current?.focus();
                    }
                    return;
                  }
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setResaltada((x) => (x + 1) % sugerencias.length);
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setResaltada((x) => (x - 1 + sugerencias.length) % sugerencias.length);
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    elegir(sugerencias[resaltada]);
                  } else if (e.key === "Escape") setAbierto(false);
                }}
                role="combobox"
                aria-expanded={abierto && sugerencias.length > 0}
                aria-controls={`sug-${valor.clave}`}
                aria-autocomplete="list"
              />
              <AnimatePresence>
                {abierto && sugerencias.length > 0 && (
                  <motion.ul
                    className="gala-sugerencias"
                    id={`sug-${valor.clave}`}
                    role="listbox"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18 }}
                  >
                    {sugerencias.map((p, i) => (
                      <li key={p.id} role="option" aria-selected={i === resaltada}>
                        <button type="button" data-activo={i === resaltada || undefined} onMouseDown={(e) => e.preventDefault()} onClick={() => elegir(p)}>
                          <b>{p.nombre}</b>
                          <small>{[p.cargo, p.municipio].filter(Boolean).join(" · ") || "Registrado en el campus"}</small>
                        </button>
                      </li>
                    ))}
                    <li className="gala-sugerencias-pie">Elige del directorio para que la postulación quede amarrada a su cuenta, o sigue escribiendo el nombre completo.</li>
                  </motion.ul>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
        {!entrada.userId && (
          <span className="gala-ayuda">
            {buscando ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> Buscando en el directorio…
              </span>
            ) : (
              <span>Si no aparece en el directorio, escribe el nombre completo.</span>
            )}
          </span>
        )}
      </div>

      <div className="gala-campo">
        <label htmlFor={`motivo-${valor.clave}`}>¿Qué comportamiento o aporte observaste?</label>
        <div className="gala-frases" aria-label="Frases para empezar">
          {FRASES[valor.clave].map((f) => (
            <button key={f} type="button" onClick={() => usarFrase(f)}>
              {f.trim()}…
            </button>
          ))}
        </div>
        <textarea
          ref={motivoRef}
          id={`motivo-${valor.clave}`}
          className="gala-input"
          placeholder="Describe una situación concreta en la que esta persona demostró este valor."
          maxLength={600}
          value={entrada.motivo}
          onChange={(e) => onChange({ ...entrada, motivo: e.target.value })}
        />
        <span className="gala-ayuda">
          <span className="gala-mini-anillo">
            <svg viewBox="0 0 18 18" aria-hidden="true">
              <circle className="pista" cx="9" cy="9" r={r} />
              <circle className="relleno" cx="9" cy="9" r={r} strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(largo / MIN_MOTIVO, 1))} />
            </svg>
            {faltan > 0 ? (
              `Faltan ${faltan} caracteres`
            ) : (
              <>
                <Check className="inline h-3 w-3" aria-hidden="true" /> Listo
              </>
            )}
          </span>
          <span>{entrada.motivo.length}/600</span>
        </span>
      </div>
    </>
  );
}

/* ───────────── Celebración al enviar ───────────── */

function Confeti() {
  const colores = ["oklch(70% 0.15 75)", "oklch(58% 0.14 230)", "oklch(58% 0.14 165)", "oklch(62% 0.16 40)", "oklch(80% 0.12 90)"];
  const piezas = Array.from({ length: 46 }, (_, i) => {
    const a = (i * 137.5 * Math.PI) / 180;
    const d = 160 + ((i * 53) % 220);
    return { i, x: Math.cos(a) * d, y: Math.sin(a) * d * 0.7 - 60, rot: (i * 47) % 360, color: colores[i % colores.length] };
  });
  return (
    <div className="gala-confeti" aria-hidden="true">
      {piezas.map((p) => (
        <motion.i
          key={p.i}
          style={{ background: p.color }}
          initial={{ x: 0, y: 0, rotate: 0, opacity: 1, scale: 0.6 }}
          animate={{ x: p.x, y: [0, p.y, p.y + 320], rotate: p.rot + 540, opacity: [1, 1, 0], scale: 1 }}
          transition={{ duration: 1.6, ease: [0.2, 0.7, 0.3, 1], times: [0, 0.35, 1] }}
        />
      ))}
    </div>
  );
}
