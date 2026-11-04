"use client";

/* eslint-disable @next/next/no-img-element -- logo institucional subido por el admin */

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, Eye, EyeOff, HandHeart, Maximize, MessageSquareQuote, Printer, RotateCcw, ShieldCheck, Sparkles, Trophy, Users, X } from "lucide-react";
import type { GalardonValor } from "@prisma/client";
import ScrollMorphHero from "@/components/ui/scroll-morph-hero";
import { ORDEN_VALORES, valorInfo } from "@/lib/galardones/valores";
import type { Ganador, GanadoresIps } from "@/lib/galardones/consultas";

type Modo = "presentar" | "tablero" | "apertura";
type Revelados = Record<string, GalardonValor[]>;
const ICONOS: Record<GalardonValor, typeof ShieldCheck> = { INTEGRIDAD: ShieldCheck, HUMANIZACION: HandHeart, LIDERAZGO: Users };
const EASE = [0.16, 1, 0.3, 1] as const;
const sinSuscripcion = () => () => {};

/**
 * CEREMONIA DE GALARDONES: lo que Talento Humano proyecta en el evento.
 *
 * PRESENTAR (por defecto): a la izquierda los 17 centros con su avance; al
 * centro, las tres tarjetas del centro elegido -una por valor- que se
 * revelan con un clic o con Espacio. Opcionalmente se leen los testimonios
 * de quienes postularon. TABLERO: todos los ganadores en una tabla centro ×
 * valor, para cerrar el evento o imprimir. APERTURA: el arco de tarjetas
 * (scroll-morph-hero), cada una lleva a su centro.
 *
 * El avance (qué ya se reveló) se guarda en este navegador: si la página se
 * recarga en plena ceremonia, se retoma donde iba.
 */
export function CeremoniaGalardones(props: { centros: GanadoresIps[]; anio: number; institucion: string; logoUrl: string | null; salirA: string }) {
  // Solo en el navegador: mide la pantalla, anima y lee el avance guardado.
  const montado = useSyncExternalStore(sinSuscripcion, () => true, () => false);
  if (!montado) return <div className="cer" aria-busy="true" />;
  return <Ceremonia {...props} />;
}

function Ceremonia({ centros, anio, institucion, logoUrl, salirA }: { centros: GanadoresIps[]; anio: number; institucion: string; logoUrl: string | null; salirA: string }) {
  const clave = `galardones-ceremonia-${anio}`;
  const [modo, setModo] = useState<Modo>("presentar");
  const [idx, setIdx] = useState(0);
  const [revelados, setRevelados] = useState<Revelados>(() => {
    try {
      return (JSON.parse(localStorage.getItem(clave) ?? "{}") as Revelados) ?? {};
    } catch {
      return {};
    }
  });
  const [conteos, setConteos] = useState(false);
  const [testimonios, setTestimonios] = useState(false);
  const [mostrarTodos, setMostrarTodos] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(clave, JSON.stringify(revelados));
    } catch {
      /* sin almacenamiento */
    }
  }, [clave, revelados]);

  const centro = centros[idx];
  const reveladosDe = useCallback((ips: string) => revelados[ips] ?? [], [revelados]);
  const revelar = useCallback((ips: string, valor: GalardonValor) => setRevelados((r) => (r[ips]?.includes(valor) ? r : { ...r, [ips]: [...(r[ips] ?? []), valor] })), []);
  const revelarTodo = useCallback((ips: string) => setRevelados((r) => ({ ...r, [ips]: [...ORDEN_VALORES] })), []);
  const reiniciar = () => {
    if (confirm("¿Volver a ocultar todos los ganadores? El avance de la ceremonia empieza de cero.")) setRevelados({});
  };

  const irA = useCallback((i: number) => setIdx(Math.max(0, Math.min(centros.length - 1, i))), [centros.length]);

  /** Espacio: revela el siguiente valor del centro; si ya están los tres, pasa al siguiente centro. */
  const avanzar = useCallback(() => {
    if (!centro) return;
    const pendiente = ORDEN_VALORES.find((v) => !reveladosDe(centro.ips).includes(v));
    if (pendiente) revelar(centro.ips, pendiente);
    else if (idx < centros.length - 1) irA(idx + 1);
    else setModo("tablero");
  }, [centro, reveladosDe, revelar, idx, centros.length, irA]);

  const pantallaCompleta = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "f") pantallaCompleta();
      else if (k === "c") setConteos((x) => !x);
      else if (k === "m") setTestimonios((x) => !x);
      else if (k === "t") setModo("tablero");
      else if (k === "p") setModo("presentar");
      if (modo !== "presentar" || !centro) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        avanzar();
      } else if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === "ArrowDown") {
        e.preventDefault();
        irA(idx + 1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp" || e.key === "ArrowUp") {
        e.preventDefault();
        irA(idx - 1);
      } else if (["1", "2", "3"].includes(e.key)) {
        revelar(centro.ips, ORDEN_VALORES[Number(e.key) - 1]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modo, centro, avanzar, irA, idx, revelar]);

  const totalRevelados = centros.reduce((n, c) => n + reveladosDe(c.ips).length, 0);

  return (
    <div className="cer" aria-label={`Ceremonia de Galardones ${anio}`}>
      <header className="cer-barra">
        <div className="cer-marca">
          {logoUrl && <img src={logoUrl} alt="" />}
          <div className="min-w-0">
            <b className="cer-display">Galardones {anio}</b>
            <small>
              {institucion} · {totalRevelados} de {centros.length * 3} revelados
            </small>
          </div>
        </div>
        <div className="cer-modos" role="group" aria-label="Vista">
          {(
            [
              ["presentar", "Presentar"],
              ["tablero", "Tablero"],
              ["apertura", "Apertura"],
            ] as const
          ).map(([m, t]) => (
            <button key={m} type="button" aria-pressed={modo === m} onClick={() => setModo(m)}>
              {t}
            </button>
          ))}
        </div>
        <button type="button" className="cer-boton" aria-pressed={testimonios} onClick={() => setTestimonios((x) => !x)} title="Testimonios de quienes postularon (M)">
          <MessageSquareQuote className="h-4 w-4" aria-hidden="true" />
          <span className="cer-texto">Testimonios</span>
        </button>
        <button type="button" className="cer-boton" aria-pressed={conteos} onClick={() => setConteos((x) => !x)} title="Número de postulaciones (C)">
          {conteos ? <Eye className="h-4 w-4" aria-hidden="true" /> : <EyeOff className="h-4 w-4" aria-hidden="true" />}
          <span className="cer-texto">Conteos</span>
        </button>
        <button type="button" className="cer-boton cer-icono-solo" onClick={pantallaCompleta} title="Pantalla completa (F)" aria-label="Pantalla completa">
          <Maximize className="h-4 w-4" aria-hidden="true" />
        </button>
        <Link href={salirA} className="cer-boton cer-icono-solo" title="Salir" aria-label="Salir">
          <X className="h-4 w-4" aria-hidden="true" />
        </Link>
      </header>

      {modo === "presentar" && centro && (
        <div className="cer-presentar">
          <nav className="cer-lista" aria-label="Centros IPS">
            <h2>Centros IPS</h2>
            <ol>
              {centros.map((c, i) => {
                const r = reveladosDe(c.ips);
                return (
                  <li key={c.ips}>
                    <button type="button" onClick={() => irA(i)} aria-current={i === idx} data-completo={r.length === 3 || undefined}>
                      <span className="n">{r.length === 3 ? "✓" : String(i + 1).padStart(2, "0")}</span>
                      <span className="nombre">{c.ips}</span>
                      <span className="cer-puntos" aria-label={`${r.length} de 3 revelados`}>
                        {ORDEN_VALORES.map((v) => (
                          <i key={v} data-on={r.includes(v) || undefined} style={{ ["--c-v" as string]: `oklch(52% 0.14 ${valorInfo(v).matiz})` }} />
                        ))}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>

          <section className="cer-escenario" aria-label={`Centro ${centro.ips}`}>
            <AnimatePresence mode="wait">
              <motion.div
                key={centro.ips}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.35, ease: EASE }}
                className="flex flex-1 flex-col"
              >
                <div className="cer-cabeza">
                  <div>
                    <small>
                      Centro IPS {idx + 1} de {centros.length}
                    </small>
                    <h1 className="cer-display">{centro.ips}</h1>
                    <p>
                      {centro.votantes > 0
                        ? `${centro.votantes} ${centro.votantes === 1 ? "colaborador postuló" : "colaboradores postularon"} a sus compañeros`
                        : "Este centro no registró postulaciones"}
                    </p>
                  </div>
                  <button type="button" className="cer-boton" onClick={() => revelarTodo(centro.ips)} disabled={reveladosDe(centro.ips).length === 3}>
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                    Revelar los tres
                  </button>
                </div>

                <div className="cer-tarjetas">
                  {centro.ganadores.map((g, n) => (
                    <TarjetaValor
                      key={g.valor}
                      g={g}
                      tecla={n + 1}
                      revelado={reveladosDe(centro.ips).includes(g.valor)}
                      onRevelar={() => revelar(centro.ips, g.valor)}
                      conteos={conteos}
                      testimonios={testimonios}
                    />
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>

            <div className="cer-pie">
              <div className="cer-pie-grupo">
                <button type="button" className="cer-boton cer-boton-grande" onClick={() => irA(idx - 1)} disabled={idx === 0}>
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  {idx > 0 ? centros[idx - 1].ips : "Anterior"}
                </button>
                <button type="button" className="cer-boton cer-boton-grande cer-boton-fuerte" onClick={avanzar}>
                  {(() => {
                    const pendiente = ORDEN_VALORES.find((v) => !reveladosDe(centro.ips).includes(v));
                    if (pendiente) return `Revelar ${valorInfo(pendiente).nombre}`;
                    return idx < centros.length - 1 ? `Siguiente: ${centros[idx + 1].ips}` : "Ver tablero";
                  })()}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <div className="cer-atajos" aria-hidden="true">
                <span>
                  <kbd>Espacio</kbd>revelar / seguir
                </span>
                <span>
                  <kbd>1</kbd>
                  <kbd>2</kbd>
                  <kbd>3</kbd>un valor
                </span>
                <span>
                  <kbd>←</kbd>
                  <kbd>→</kbd>centro
                </span>
                <span>
                  <kbd>T</kbd>tablero
                </span>
              </div>
              <button type="button" className="cer-boton" onClick={reiniciar} title="Ocultar todo y empezar de nuevo">
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                Reiniciar
              </button>
            </div>
          </section>
        </div>
      )}

      {modo === "tablero" && (
        <Tablero
          centros={centros}
          anio={anio}
          reveladosDe={reveladosDe}
          mostrarTodos={mostrarTodos}
          onMostrarTodos={() => setMostrarTodos((x) => !x)}
          conteos={conteos}
          onIr={(i) => {
            irA(i);
            setModo("presentar");
          }}
        />
      )}

      {modo === "apertura" && (
        <Apertura
          centros={centros}
          anio={anio}
          onIr={(i) => {
            irA(i);
            setModo("presentar");
          }}
        />
      )}
    </div>
  );
}

/* ───────────── Tarjeta de un valor ───────────── */

function TarjetaValor({
  g,
  tecla,
  revelado,
  onRevelar,
  conteos,
  testimonios,
}: {
  g: Ganador;
  tecla: number;
  revelado: boolean;
  onRevelar: () => void;
  conteos: boolean;
  testimonios: boolean;
}) {
  const info = valorInfo(g.valor);
  const Icono = ICONOS[g.valor];
  const reducir = useReducedMotion();
  const persona = g.personas[0];
  return (
    <article className="cer-tarjeta" style={{ ["--c-h" as string]: info.matiz }}>
      <div className="cer-tarjeta-cab">
        <span className="cer-tarjeta-icono">
          <Icono className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <small>Valor {info.numero}</small>
          <b className="cer-display">{info.nombre}</b>
        </div>
      </div>
      <div className="cer-tarjeta-cuerpo" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          {!revelado ? (
            <motion.button
              key="sellada"
              type="button"
              className="cer-sellada"
              onClick={onRevelar}
              exit={reducir ? { opacity: 0 } : { opacity: 0, scale: 0.96, filter: "blur(6px)" }}
              transition={{ duration: 0.2 }}
            >
              <Trophy className="h-7 w-7" aria-hidden="true" />
              <span>Revelar ganador</span>
              <kbd>{tecla}</kbd>
            </motion.button>
          ) : (
            <motion.div
              key="ganador"
              className="cer-ganador relative"
              initial={reducir ? false : { opacity: 0, y: 18, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.6, ease: EASE }}
            >
              {g.personas.length === 0 ? (
                <p className="cer-sin">Sin ganador en este valor</p>
              ) : (
                <>
                  <small>
                    <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
                    {g.empate ? "Empate" : "Ganador"}
                  </small>
                  <h3 className={`cer-display ${g.empate ? "cer-empate" : ""}`}>
                    {g.personas.map((p) => p.nombre).join(" · ")}
                    {g.empate && <span className="cer-badge">Por definir</span>}
                  </h3>
                  {conteos && persona && (
                    <p className="cer-conteo">
                      {persona.votos} {persona.votos === 1 ? "postulación" : "postulaciones"} de {g.total} · {persona.porcentaje}%
                    </p>
                  )}
                  {testimonios && !g.empate && persona && persona.testimonios.length > 0 && (
                    <ul className="cer-testimonios">
                      {persona.testimonios.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  )}
                  {!reducir && <Chispas />}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </article>
  );
}

function Chispas() {
  const colores = ["oklch(72% 0.14 78)", "oklch(52% 0.14 var(--c-h))", "oklch(82% 0.12 90)"];
  return (
    <>
      {Array.from({ length: 16 }, (_, k) => {
        const a = (k / 16) * Math.PI * 2;
        const d = 70 + (k % 4) * 26;
        return (
          <motion.span
            key={k}
            className="cer-chispa"
            style={{ background: colores[k % 3] }}
            initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
            animate={{ x: Math.cos(a) * d, y: Math.sin(a) * d, opacity: 0, rotate: 180 }}
            transition={{ duration: 1, ease: EASE, delay: 0.1 }}
            aria-hidden="true"
          />
        );
      })}
    </>
  );
}

/* ───────────── Tablero: todos los ganadores ───────────── */

function Tablero({
  centros,
  anio,
  reveladosDe,
  mostrarTodos,
  onMostrarTodos,
  conteos,
  onIr,
}: {
  centros: GanadoresIps[];
  anio: number;
  reveladosDe: (ips: string) => GalardonValor[];
  mostrarTodos: boolean;
  onMostrarTodos: () => void;
  conteos: boolean;
  onIr: (i: number) => void;
}) {
  const [q, setQ] = useState("");
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const filas = useMemo(() => {
    const f = norm(q.trim());
    return centros
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => !f || norm(c.ips).includes(f) || c.ganadores.some((g) => g.personas.some((p) => norm(p.nombre).includes(f))));
  }, [centros, q]);

  return (
    <section className="cer-tablero" aria-label="Tablero de ganadores">
      <div className="cer-tablero-cab">
        <div>
          <h1 className="cer-display">Ganadores {anio}</h1>
          <p>Tres personas por centro, una por valor. Toca un centro para presentarlo.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2" data-no-imprimir>
          <input className="cer-buscar" placeholder="Buscar centro o persona…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar" />
          <button type="button" className="cer-boton" aria-pressed={mostrarTodos} onClick={onMostrarTodos}>
            {mostrarTodos ? <Eye className="h-4 w-4" aria-hidden="true" /> : <EyeOff className="h-4 w-4" aria-hidden="true" />}
            {mostrarTodos ? "Mostrando todos" : "Solo revelados"}
          </button>
          <button type="button" className="cer-boton" onClick={() => window.print()}>
            <Printer className="h-4 w-4" aria-hidden="true" />
            Imprimir
          </button>
        </div>
      </div>
      <div className="cer-tabla-envoltura">
        <table className="cer-tabla">
          <thead>
            <tr>
              <th>Centro IPS</th>
              {ORDEN_VALORES.map((v) => (
                <th key={v} data-valor style={{ ["--c-h" as string]: valorInfo(v).matiz }}>
                  {valorInfo(v).nombre}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map(({ c, i }) => (
              <tr key={c.ips}>
                <td>
                  <button type="button" onClick={() => onIr(i)}>
                    {c.ips}
                  </button>
                  <span className="meta">{c.votantes} postulantes</span>
                </td>
                {c.ganadores.map((g) => {
                  const visible = mostrarTodos || reveladosDe(c.ips).includes(g.valor);
                  const p = g.personas[0];
                  return (
                    <td key={g.valor}>
                      {!visible ? (
                        <span className="oculto">Por revelar</span>
                      ) : g.personas.length === 0 ? (
                        <span className="vacio">—</span>
                      ) : (
                        <>
                          <span className="persona">{g.personas.map((x) => x.nombre).join(" · ")}</span>
                          {g.empate && <span className="cer-badge">Empate</span>}
                          {conteos && p && <span className="meta">{p.votos} de {g.total} postulaciones</span>}
                        </>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {filas.length === 0 && (
              <tr>
                <td colSpan={4} className="vacio">
                  Nada coincide con «{q}».
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ───────────── Apertura (opcional) ───────────── */

function Apertura({ centros, anio, onIr }: { centros: GanadoresIps[]; anio: number; onIr: (i: number) => void }) {
  const tarjetas = useMemo(
    () =>
      centros.flatMap((c, i) =>
        c.ganadores.map((g) => {
          const info = valorInfo(g.valor);
          return {
            key: `${c.ips}-${g.valor}`,
            front: (
              <button type="button" className="cer-carta" style={{ ["--c-h" as string]: info.matiz }} onClick={() => onIr(i)} title={`${c.ips} · ${info.nombre}`}>
                <b>{c.ips}</b>
                <small>Valor {info.numero}</small>
              </button>
            ),
            back: (
              <button type="button" className="cer-carta cer-carta-dorso" style={{ ["--c-h" as string]: info.matiz }} onClick={() => onIr(i)} aria-label={`Ir a ${c.ips}`}>
                <Trophy className="h-4 w-4" aria-hidden="true" />
              </button>
            ),
          };
        }),
      ),
    [centros, onIr],
  );
  return (
    <div className="cer-apertura">
      <ScrollMorphHero
        cards={tarjetas}
        cardWidth={58}
        cardHeight={82}
        introHint={<span style={{ color: "var(--c-tenue)" }}>Desplaza para abrir</span>}
        introTitle={
          <div>
            <h1 className="cer-display">
              Galardones <em>{anio}</em>
            </h1>
            <p className="lema">Salud y Vida para el Llano</p>
          </div>
        }
        arcContent={
          <div className="max-w-2xl">
            <h2 className="cer-display text-[clamp(1.8rem,1.1rem+2.6vw,3.6rem)] font-extrabold leading-[0.98] tracking-[-0.03em]">
              {centros.length} centros · {centros.length * 3} galardones
            </h2>
            <p className="mx-auto mt-3 max-w-[46ch] text-[clamp(0.9rem,0.8rem+0.3vw,1.05rem)] leading-relaxed" style={{ color: "var(--c-tinta-2)" }}>
              Integridad, Humanización y Liderazgo. En cada centro ganan las tres personas más postuladas por sus compañeros. Toca una tarjeta para ir a
              su centro.
            </p>
            <button type="button" className="cer-boton cer-boton-grande cer-boton-fuerte mx-auto mt-6" onClick={() => onIr(0)}>
              Empezar la ceremonia
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        }
      />
    </div>
  );
}
