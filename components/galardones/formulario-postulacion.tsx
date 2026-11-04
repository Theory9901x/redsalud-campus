"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Building2, Check, HandHeart, Loader2, Send, ShieldCheck, Sparkles, UserCheck, Users } from "lucide-react";
import type { GalardonValor } from "@prisma/client";
import { toast } from "sonner";
import { IPS_GALARDONES, type IpsGalardon } from "@/lib/galardones/ips";
import { VALORES_GALARDON } from "@/lib/galardones/valores";
import { buscarPersonas, enviarPostulacion, type PersonaDirectorio } from "@/app/galardones/acciones";
import { SIGNATURE_EASE } from "@/lib/motion";

const ICONOS: Record<GalardonValor, typeof ShieldCheck> = { INTEGRIDAD: ShieldCheck, HUMANIZACION: HandHeart, LIDERAZGO: Users };

type Entrada = { nombre: string; userId: string | null; motivo: string };
const VACIA: Entrada = { nombre: "", userId: null, motivo: "" };
const MIN_MOTIVO = 15;

const paso = {
  initial: { opacity: 0, y: 18, filter: "blur(4px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.45, ease: SIGNATURE_EASE } },
  exit: { opacity: 0, y: -12, filter: "blur(4px)", transition: { duration: 0.2 } },
};

/**
 * Postulación por pasos: centro IPS → un valor por pantalla → confirmación.
 * Un paso por valor a propósito: la definición del valor se lee completa
 * antes de escribir el nombre, que es lo que pide el memorando (postular por
 * comportamientos observables, no por simpatía).
 */
export function FormularioPostulacion({ nombreVotante, ipsSugerida, cierraEl }: { nombreVotante: string; ipsSugerida: IpsGalardon | null; cierraEl: string | null }) {
  const router = useRouter();
  const [indice, setIndice] = useState(0);
  const [ips, setIps] = useState<IpsGalardon | null>(ipsSugerida);
  const [entradas, setEntradas] = useState<Record<GalardonValor, Entrada>>({ INTEGRIDAD: VACIA, HUMANIZACION: VACIA, LIDERAZGO: VACIA });
  const [error, setError] = useState<string | null>(null);
  const [enviando, startEnvio] = useTransition();

  const pasos = useMemo(
    () => [{ clave: "IPS", etiqueta: "Centro IPS" }, ...VALORES_GALARDON.map((v) => ({ clave: v.clave, etiqueta: v.nombre })), { clave: "FIN", etiqueta: "Confirmar" }],
    [],
  );
  const valorActual = indice >= 1 && indice <= 3 ? VALORES_GALARDON[indice - 1] : null;
  const matizActual = valorActual?.matiz ?? (indice === 4 ? 85 : 225);

  const entradaCompleta = (e: Entrada) => e.nombre.trim().length >= 3 && e.motivo.trim().length >= MIN_MOTIVO;
  const puedeAvanzar = indice === 0 ? !!ips : valorActual ? entradaCompleta(entradas[valorActual.clave]) : true;
  const todoListo = !!ips && VALORES_GALARDON.every((v) => entradaCompleta(entradas[v.clave]));

  const irA = (i: number) => {
    setError(null);
    setIndice(i);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const enviar = () => {
    if (!ips || !todoListo) return;
    setError(null);
    startEnvio(async () => {
      const r = await enviarPostulacion({
        ips,
        postulaciones: VALORES_GALARDON.map((v) => ({ valor: v.clave, ...entradas[v.clave], nombre: entradas[v.clave].nombre.trim(), motivo: entradas[v.clave].motivo.trim() })),
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      toast.success("Postulación registrada. ¡Gracias por reconocer a tus compañeros!");
      router.refresh();
    });
  };

  return (
    <section className="mt-6" style={{ ["--g-h" as string]: matizActual }} aria-label="Formulario de postulación">
      <nav className="gala-riel" aria-label="Pasos">
        {pasos.map((p, i) => {
          const estado = i === indice ? "activo" : i < indice ? "hecho" : "pendiente";
          const habilitado = i < indice || (i === indice + 1 && puedeAvanzar) || (i === 4 && todoListo);
          return (
            <button key={p.clave} type="button" data-estado={estado} disabled={!habilitado && i !== indice} onClick={() => irA(i)} aria-current={i === indice ? "step" : undefined}>
              <span>
                {i === 0 ? "Inicio" : i === 4 ? "Final" : `Valor ${i}`}
              </span>
              <span style={{ fontSize: "0.78rem", letterSpacing: 0, textTransform: "none", fontWeight: 700 }}>{p.etiqueta}</span>
            </button>
          );
        })}
      </nav>

      <AnimatePresence mode="wait">
        {indice === 0 && (
          <motion.div key="ips" {...paso} className="gala-panel gala-panel-borde gala-valor">
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
                  ¿En qué <em>centro IPS</em> trabajas?
                </h2>
              </div>
            </div>
            <p className="gala-definicion">
              Hola, {nombreVotante.split(" ")[0]}. Las personas que postules deben ser de tu mismo centro: el reconocimiento se entrega por IPS y por valor.
            </p>
            <div className="gala-ips" role="radiogroup" aria-label="Centro IPS">
              {IPS_GALARDONES.map((nombre) => (
                <button key={nombre} type="button" role="radio" aria-checked={ips === nombre} data-activo={ips === nombre || undefined} onClick={() => setIps(nombre)}>
                  {nombre}
                  <small>{nombre === ipsSugerida ? "Tu municipio" : "IPS"}</small>
                </button>
              ))}
            </div>
            <div className="gala-acciones">
              <span className="gala-ayuda">{cierraEl ? <>Plazo: hasta el <b>{cierraEl}</b></> : "Una sola postulación por colaborador"}</span>
              <button type="button" className="gala-btn gala-btn-principal" disabled={!ips} onClick={() => irA(1)}>
                Continuar <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </motion.div>
        )}

        {valorActual && (
          <PasoValor
            key={valorActual.clave}
            indice={indice}
            valor={valorActual}
            entrada={entradas[valorActual.clave]}
            onChange={(e) => setEntradas((prev) => ({ ...prev, [valorActual.clave]: e }))}
            onAtras={() => irA(indice - 1)}
            onSiguiente={() => irA(indice + 1)}
            puedeAvanzar={puedeAvanzar}
          />
        )}

        {indice === 4 && (
          <motion.div key="fin" {...paso} className="gala-panel gala-panel-borde gala-valor">
            <div className="gala-valor-halo" />
            <div className="gala-valor-cab">
              <span className="gala-valor-icono">
                <Sparkles className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <span className="gala-mono" data-tono="a">
                  Paso 5 de 5 · {ips}
                </span>
                <h2>
                  Revisa y <em>confirma</em>
                </h2>
              </div>
            </div>
            <p className="gala-definicion">Una vez enviada, la postulación no se puede modificar. Verifica los nombres antes de confirmar.</p>
            <div className="gala-resumen">
              {VALORES_GALARDON.map((v) => {
                const e = entradas[v.clave];
                return (
                  <div key={v.clave} className="gala-resumen-fila" style={{ ["--g-h" as string]: v.matiz }}>
                    <span className="gala-mono">
                      {v.numero}. {v.nombre}
                    </span>
                    <div>
                      <b>
                        {e.nombre}
                        {e.userId ? (
                          <span className="gala-vinculo ml-2 align-middle">
                            <UserCheck className="h-3 w-3" aria-hidden="true" /> Registrado en el campus
                          </span>
                        ) : null}
                      </b>
                      <p>{e.motivo}</p>
                    </div>
                    <button type="button" className="gala-btn gala-btn-sutil gala-btn-mini" onClick={() => irA(v.numero)}>
                      Editar
                    </button>
                  </div>
                );
              })}
            </div>
            {error && (
              <p className="gala-error" role="alert">
                {error}
              </p>
            )}
            <div className="gala-acciones">
              <button type="button" className="gala-btn gala-btn-sutil" onClick={() => irA(3)}>
                <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Atrás
              </button>
              <button type="button" className="gala-btn gala-btn-principal" disabled={!todoListo || enviando} onClick={enviar}>
                {enviando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
                {enviando ? "Enviando…" : "Enviar postulación"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function PasoValor({
  indice,
  valor,
  entrada,
  onChange,
  onAtras,
  onSiguiente,
  puedeAvanzar,
}: {
  indice: number;
  valor: (typeof VALORES_GALARDON)[number];
  entrada: Entrada;
  onChange: (e: Entrada) => void;
  onAtras: () => void;
  onSiguiente: () => void;
  puedeAvanzar: boolean;
}) {
  const Icono = ICONOS[valor.clave];
  const [sugerencias, setSugerencias] = useState<PersonaDirectorio[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [resaltada, setResaltada] = useState(0);
  const ultimaBusqueda = useRef(0);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (temporizador.current) clearTimeout(temporizador.current);
    ultimaBusqueda.current++;
  }, []);

  // Autocompletar del directorio con un pequeño retardo: se consulta al
  // dejar de escribir, no en cada tecla.
  const escribirNombre = (texto: string) => {
    onChange({ ...entrada, nombre: texto, userId: null });
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
    onChange({ ...entrada, nombre: p.nombre, userId: p.id });
    setAbierto(false);
    setSugerencias([]);
  };

  const faltan = Math.max(0, MIN_MOTIVO - entrada.motivo.trim().length);

  return (
    <motion.div {...paso} className="gala-panel gala-panel-borde gala-valor" style={{ ["--g-h" as string]: valor.matiz }}>
      <div className="gala-valor-halo" />
      <span className="gala-valor-num" aria-hidden="true">
        0{valor.numero}
      </span>
      <div className="gala-valor-cab">
        <span className="gala-valor-icono">
          <Icono className="h-5 w-5" aria-hidden="true" />
        </span>
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
      <p>{valor.comportamientos}</p>

      <div className="gala-campo">
        <label htmlFor={`nombre-${valor.clave}`}>¿A quién postulas por {valor.nombre.toLowerCase()}?</label>
        <input
          id={`nombre-${valor.clave}`}
          className="gala-input"
          placeholder="Nombre y apellidos de la persona"
          autoComplete="off"
          value={entrada.nombre}
          onChange={(e) => escribirNombre(e.target.value)}
          onFocus={() => sugerencias.length && setAbierto(true)}
          onBlur={() => setTimeout(() => setAbierto(false), 150)}
          onKeyDown={(e) => {
            if (!abierto || !sugerencias.length) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setResaltada((r) => (r + 1) % sugerencias.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setResaltada((r) => (r - 1 + sugerencias.length) % sugerencias.length);
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
        {abierto && sugerencias.length > 0 && (
          <ul className="gala-sugerencias" id={`sug-${valor.clave}`} role="listbox">
            {sugerencias.map((p, i) => (
              <li key={p.id} role="option" aria-selected={i === resaltada}>
                <button type="button" data-activo={i === resaltada || undefined} onMouseDown={(e) => e.preventDefault()} onClick={() => elegir(p)}>
                  <b>{p.nombre}</b>
                  <small>{[p.cargo, p.municipio].filter(Boolean).join(" · ") || "Registrado en el campus"}</small>
                </button>
              </li>
            ))}
            <li className="gala-sugerencias-pie">Elige del directorio para que la postulación quede amarrada a su cuenta, o sigue escribiendo el nombre completo.</li>
          </ul>
        )}
        <span className="gala-ayuda">
          {entrada.userId ? (
            <span className="gala-vinculo">
              <UserCheck className="h-3 w-3" aria-hidden="true" /> Registrado en el campus
            </span>
          ) : buscando ? (
            <span>Buscando en el directorio…</span>
          ) : (
            <span>Si no aparece en el directorio, escribe el nombre completo.</span>
          )}
        </span>
      </div>

      <div className="gala-campo">
        <label htmlFor={`motivo-${valor.clave}`}>¿Qué comportamiento o aporte observaste?</label>
        <textarea
          id={`motivo-${valor.clave}`}
          className="gala-input"
          placeholder="Describe una situación concreta en la que esta persona demostró este valor."
          maxLength={600}
          value={entrada.motivo}
          onChange={(e) => onChange({ ...entrada, motivo: e.target.value })}
        />
        <span className="gala-ayuda">
          <span>{faltan > 0 ? `Faltan ${faltan} caracteres` : <><Check className="inline h-3 w-3" aria-hidden="true" /> Listo</>}</span>
          <span>{entrada.motivo.length}/600</span>
        </span>
      </div>

      <div className="gala-acciones">
        <button type="button" className="gala-btn gala-btn-sutil" onClick={onAtras}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Atrás
        </button>
        <button type="button" className="gala-btn gala-btn-principal" disabled={!puedeAvanzar} onClick={onSiguiente}>
          {indice === 3 ? "Revisar" : "Siguiente valor"} <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </motion.div>
  );
}
