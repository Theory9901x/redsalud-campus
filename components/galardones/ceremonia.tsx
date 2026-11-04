"use client";

/* eslint-disable @next/next/no-img-element -- logo institucional subido por el admin */

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, Eye, EyeOff, LayoutGrid, Maximize, Play, Printer, Trophy, X } from "lucide-react";
import ScrollMorphHero from "@/components/ui/scroll-morph-hero";
import { valorInfo } from "@/lib/galardones/valores";
import type { Ganador, GanadoresIps } from "@/lib/galardones/consultas";

type Modo = "apertura" | "escenario" | "cuadro";
const sinSuscripcion = () => () => {};
const ROMANOS = ["I", "II", "III"];
const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * CEREMONIA DE GALARDONES: lo que Talento Humano proyecta en el evento.
 *
 * 1. Apertura: los 51 galardones (17 centros × 3 valores) entran como sobres
 *    cerrados, forman un círculo y se abren en arco. No dicen nombres.
 * 2. Escenario: centro por centro, una escalera de tres peldaños -Integridad,
 *    Humanización, Liderazgo- que se revelan uno a uno con Espacio o →.
 * 3. Cuadro de honor: todos los ganadores juntos, para cerrar o imprimir.
 *
 * Gana en cada valor la persona con más postulaciones válidas; los nombres
 * ya vienen agrupados aunque se escribieran distinto. Si hay empate se
 * muestran todos los empatados: la ceremonia no elige por nadie.
 */
export function CeremoniaGalardones({
  centros,
  anio,
  institucion,
  logoUrl,
  salirA,
}: {
  centros: GanadoresIps[];
  anio: number;
  institucion: string;
  logoUrl: string | null;
  salirA: string;
}) {
  const [modo, setModo] = useState<Modo>("apertura");
  const [idx, setIdx] = useState(0);
  const [revelados, setRevelados] = useState(0);
  const [conteos, setConteos] = useState(false);
  // La apertura mide la ventana y anima con física: solo en el navegador.
  const montado = useSyncExternalStore(sinSuscripcion, () => true, () => false);

  const total = centros.length;
  const centro = centros[idx];

  const avanzar = useCallback(() => {
    if (revelados < 3) setRevelados((r) => r + 1);
    else if (idx < total - 1) {
      setIdx((i) => i + 1);
      setRevelados(0);
    } else setModo("cuadro");
  }, [revelados, idx, total]);

  const retroceder = useCallback(() => {
    if (revelados > 0) setRevelados((r) => r - 1);
    else if (idx > 0) {
      setIdx((i) => i - 1);
      setRevelados(3);
    }
  }, [revelados, idx]);

  const irA = (i: number) => {
    setIdx(i);
    setRevelados(0);
    setModo("escenario");
  };

  const pantallaCompleta = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
      const k = e.key.toLowerCase();
      if (k === "f") pantallaCompleta();
      if (k === "c") setConteos((c) => !c);
      if (k === "t") setModo((m) => (m === "cuadro" ? "escenario" : "cuadro"));
      if (modo !== "escenario") return;
      if (e.key === " " || e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        avanzar();
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        retroceder();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modo, avanzar, retroceder]);

  return (
    <div className="cer" role="application" aria-label={`Ceremonia de Galardones ${anio}`}>
      <header className="cer-barra">
        <div className="cer-marca">
          {logoUrl && <img src={logoUrl} alt="" />}
          <div className="min-w-0">
            <b className="truncate">{institucion}</b>
            <small>Galardones {anio}</small>
          </div>
        </div>
        <div className="cer-controles">
          {modo !== "apertura" && (
            <button type="button" className="cer-boton" aria-pressed={conteos} onClick={() => setConteos((c) => !c)} title="Mostrar u ocultar el número de postulaciones (C)">
              {conteos ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              <span>Conteos</span>
            </button>
          )}
          {modo !== "escenario" && (
            <button type="button" className="cer-boton" onClick={() => setModo("escenario")} title="Escenario por centro">
              <Play className="h-3.5 w-3.5" />
              <span>Escenario</span>
            </button>
          )}
          {modo !== "cuadro" && (
            <button type="button" className="cer-boton" onClick={() => setModo("cuadro")} title="Cuadro de honor (T)">
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Cuadro de honor</span>
            </button>
          )}
          <button type="button" className="cer-boton" onClick={pantallaCompleta} title="Pantalla completa (F)">
            <Maximize className="h-3.5 w-3.5" />
            <span>Pantalla completa</span>
          </button>
          <Link href={salirA} className="cer-boton" title="Salir">
            <X className="h-3.5 w-3.5" />
            <span>Salir</span>
          </Link>
        </div>
      </header>

      {modo === "apertura" && montado && <Apertura centros={centros} anio={anio} onComenzar={() => setModo("escenario")} onCuadro={() => setModo("cuadro")} />}
      {modo === "escenario" && centro && (
        <Escenario centros={centros} idx={idx} revelados={revelados} conteos={conteos} onAvanzar={avanzar} onRetroceder={retroceder} onIr={irA} />
      )}
      {modo === "cuadro" && <Cuadro centros={centros} anio={anio} conteos={conteos} onIr={irA} />}
    </div>
  );
}

/* ───────────────────────── Apertura ───────────────────────── */

function Apertura({ centros, anio, onComenzar, onCuadro }: { centros: GanadoresIps[]; anio: number; onComenzar: () => void; onCuadro: () => void }) {
  const tarjetas = useMemo(
    () =>
      centros.flatMap((c) =>
        c.ganadores.map((g, i) => {
          const info = valorInfo(g.valor);
          return {
            key: `${c.ips}-${g.valor}`,
            front: (
              <div className="cer-sobre" style={{ ["--c-h" as string]: info.matiz }}>
                <b className="cer-serif">{ROMANOS[i]}</b>
                <small>{c.ips}</small>
              </div>
            ),
            back: (
              <div className="cer-sobre cer-sobre-dorso" style={{ ["--c-h" as string]: info.matiz }}>
                <Trophy className="h-4 w-4" aria-hidden="true" />
              </div>
            ),
          };
        }),
      ),
    [centros],
  );

  return (
    <ScrollMorphHero
      cards={tarjetas}
      cardWidth={56}
      cardHeight={80}
      introHint={<span style={{ color: "var(--c-oro-osc)" }}>Desplaza para abrir los galardones</span>}
      introTitle={
        <div>
          <p className="cer-eyebrow">Reconocimiento al mérito</p>
          <h1 className="cer-serif cer-titulo-apertura mt-4">
            Galardones <em>{anio}</em>
          </h1>
          <p className="cer-serif mt-4 text-[clamp(1.1rem,0.8rem+1vw,1.8rem)] italic" style={{ color: "var(--c-tinta-2)" }}>
            Salud y Vida para el Llano
          </p>
        </div>
      }
      arcContent={
        <div className="max-w-2xl">
          <p className="cer-eyebrow">Código de Integridad</p>
          <h2 className="cer-serif mt-3 text-[clamp(2rem,1.2rem+3vw,4.2rem)] font-medium leading-[0.95] tracking-[-0.03em]">
            {centros.length} centros, <em className="font-normal italic" style={{ color: "var(--c-oro-osc)" }}>tres valores</em>
          </h2>
          <p className="mx-auto mt-4 max-w-[46ch] text-[clamp(0.9rem,0.8rem+0.3vw,1.05rem)] leading-relaxed" style={{ color: "var(--c-tinta-2)" }}>
            En cada centro, sus compañeros eligieron a quien vive con su ejemplo la Integridad, la Humanización y el Liderazgo. Gana quien más veces fue
            postulado.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <button type="button" className="cer-boton cer-boton-oro" onClick={onComenzar}>
              Comenzar la ceremonia
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <button type="button" className="cer-boton" onClick={onCuadro}>
              <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
              Ver cuadro de honor
            </button>
          </div>
        </div>
      }
    />
  );
}

/* ───────────────────────── Escenario ───────────────────────── */

function Escenario({
  centros,
  idx,
  revelados,
  conteos,
  onAvanzar,
  onRetroceder,
  onIr,
}: {
  centros: GanadoresIps[];
  idx: number;
  revelados: number;
  conteos: boolean;
  onAvanzar: () => void;
  onRetroceder: () => void;
  onIr: (i: number) => void;
}) {
  const centro = centros[idx];
  const reducir = useReducedMotion();
  return (
    <section className="cer-escenario" aria-label={`Centro ${centro.ips}`}>
      <div className="cer-centro">
        <AnimatePresence mode="wait">
          <motion.div
            key={centro.ips}
            initial={reducir ? false : { opacity: 0, y: 30, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={reducir ? undefined : { opacity: 0, y: -20, filter: "blur(6px)" }}
            transition={{ duration: 0.7, ease: EASE }}
          >
            <p className="cer-contador">
              Centro IPS · <b>{String(idx + 1).padStart(2, "0")}</b> de {String(centros.length).padStart(2, "0")}
            </p>
            <h2 className="cer-serif cer-municipio">{centro.ips}</h2>
            <span className="cer-filete" aria-hidden="true" />
            <p className="cer-serif cer-participacion">
              {centro.votantes > 0
                ? `${centro.votantes} ${centro.votantes === 1 ? "colaborador postuló" : "colaboradores postularon"} a sus compañeros`
                : "Este centro no registró postulaciones"}
            </p>
          </motion.div>
        </AnimatePresence>
        <div className="flex flex-wrap items-center gap-2">
          <p className="cer-pista">
            <span className="cer-tecla">Espacio</span> revelar
            <span className="cer-tecla">←</span>
            <span className="cer-tecla">→</span> moverse
          </p>
        </div>
        <div className="mt-5 flex gap-2">
          <button type="button" className="cer-boton" onClick={onRetroceder} disabled={idx === 0 && revelados === 0} aria-label="Anterior">
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
          <button type="button" className="cer-boton cer-boton-oro !h-[2.1rem] !px-4 !text-[0.78rem]" onClick={onAvanzar}>
            {revelados < 3 ? `Revelar ${valorInfo(centro.ganadores[revelados].valor).nombre}` : idx < centros.length - 1 ? `Siguiente: ${centros[idx + 1].ips}` : "Cuadro de honor"}
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <ol className="cer-escalera" aria-live="polite">
        {centro.ganadores.map((g, i) => (
          <Peldano key={`${centro.ips}-${g.valor}`} ganador={g} i={i} revelado={i < revelados} conteos={conteos} />
        ))}
      </ol>

      <nav className="cer-riel" aria-label="Centros">
        {centros.map((c, i) => (
          <button
            key={c.ips}
            type="button"
            onClick={() => onIr(i)}
            aria-current={i === idx ? "step" : undefined}
            data-hecho={i < idx || (i === idx && revelados === 3) || undefined}
          >
            {c.ips}
          </button>
        ))}
      </nav>
    </section>
  );
}

function Peldano({ ganador, i, revelado, conteos }: { ganador: Ganador; i: number; revelado: boolean; conteos: boolean }) {
  const info = valorInfo(ganador.valor);
  const reducir = useReducedMotion();
  const nadie = ganador.personas.length === 0;
  return (
    <li className="cer-peldano" style={{ ["--i" as string]: i, ["--c-h" as string]: info.matiz }}>
      <motion.div
        className="cer-placa"
        data-revelada={revelado || undefined}
        initial={false}
        animate={revelado && !reducir ? { rotateX: [70, 0], opacity: [0.4, 1] } : { rotateX: 0, opacity: 1 }}
        transition={{ duration: 0.9, ease: EASE }}
      >
        <span className="cer-numeral cer-serif" aria-hidden="true">
          {ROMANOS[i]}
        </span>
        <div className="min-w-0">
          <p className="cer-valor">{info.nombre}</p>
          {revelado ? (
            <motion.div initial={reducir ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.25, ease: EASE }}>
              {nadie ? (
                <p className="cer-serif cer-nombre italic" style={{ color: "var(--c-tenue)" }}>
                  Sin postulaciones
                </p>
              ) : (
                <p className={`cer-serif cer-nombre ${ganador.empate ? "cer-nombre-empate" : ""}`}>
                  {ganador.personas.map((p) => p.nombre).join(" · ")}
                  {ganador.empate && <span className="cer-sello">Empate</span>}
                </p>
              )}
              {conteos && !nadie && (
                <p className="cer-conteo">
                  {ganador.personas[0].votos} {ganador.personas[0].votos === 1 ? "postulación" : "postulaciones"} de {ganador.total} · {ganador.personas[0].porcentaje}%
                </p>
              )}
            </motion.div>
          ) : (
            <div className="cer-sellado" aria-label="Por revelar">
              <i style={{ width: "46%" }} />
              <i style={{ width: "28%" }} />
            </div>
          )}
        </div>
        {revelado && !reducir && !nadie && <Chispas />}
      </motion.div>
    </li>
  );
}

/** Destello de oro al revelar: doce chispas que salen del numeral. */
function Chispas() {
  return (
    <>
      {Array.from({ length: 12 }, (_, k) => {
        const ang = (k / 12) * Math.PI * 2;
        const d = 46 + (k % 3) * 18;
        return (
          <motion.span
            key={k}
            className="cer-chispa"
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: Math.cos(ang) * d, y: Math.sin(ang) * d, opacity: 0, scale: 0.3 }}
            transition={{ duration: 1.1, ease: EASE, delay: 0.15 }}
            aria-hidden="true"
          />
        );
      })}
    </>
  );
}

/* ───────────────────────── Cuadro de honor ───────────────────────── */

function Cuadro({ centros, anio, conteos, onIr }: { centros: GanadoresIps[]; anio: number; conteos: boolean; onIr: (i: number) => void }) {
  const reducir = useReducedMotion();
  return (
    <section className="cer-cuadro" aria-label="Cuadro de honor">
      <div className="cer-cuadro-cab">
        <p className="cer-eyebrow">Salud y Vida para el Llano · {anio}</p>
        <h2 className="cer-serif">
          Cuadro de <em>honor</em>
        </h2>
        <button type="button" className="cer-boton mx-auto mt-5" onClick={() => window.print()} data-no-imprimir>
          <Printer className="h-3.5 w-3.5" aria-hidden="true" />
          Imprimir
        </button>
      </div>
      <div className="cer-rejilla">
        {centros.map((c, n) => (
          <motion.article
            key={c.ips}
            className="cer-ficha"
            initial={reducir ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: Math.min(n * 0.04, 0.6), ease: EASE }}
          >
            <h3 className="cer-serif">
              <button type="button" onClick={() => onIr(n)} className="text-left hover:underline" title="Ver en el escenario">
                {c.ips}
              </button>
              <span>{c.votantes} postulantes</span>
            </h3>
            <ol>
              {c.ganadores.map((g) => {
                const info = valorInfo(g.valor);
                return (
                  <li key={g.valor} style={{ ["--c-h" as string]: info.matiz }}>
                    <div>
                      <small>{info.nombre}</small>
                      {g.personas.length ? (
                        <b className="cer-serif">
                          {g.personas.map((p) => p.nombre).join(" · ")}
                          {g.empate && <span className="cer-sello">Empate</span>}
                        </b>
                      ) : (
                        <b className="cer-serif">
                          <i>Sin postulaciones</i>
                        </b>
                      )}
                      {conteos && g.personas.length > 0 && (
                        <span className="text-[0.72rem]" style={{ color: "var(--c-tenue)" }}>
                          {g.personas[0].votos} de {g.total}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </motion.article>
        ))}
      </div>
    </section>
  );
}
