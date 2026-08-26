"use client";

import { useMemo, useState, useTransition } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, FileText, Loader2, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { leerConfig, type ConfigPregunta, type ValorRespuesta } from "@/lib/encuestas/tipos";
import type { SurveyQuestionType } from "@prisma/client";

export type PreguntaFormulario = {
  id: string;
  type: SurveyQuestionType;
  prompt: string;
  description: string | null;
  imageUrl: string | null;
  isRequired: boolean;
  config: unknown;
};

export type PaginaFormulario = {
  id: string;
  title: string;
  description: string | null;
  attachmentUrl: string | null;
  attachmentName: string | null;
  questions: PreguntaFormulario[];
};

export type EncuestaFormulario = {
  id: string;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  themeColor: string | null;
  estimatedMinutes: number | null;
  thankYouMessage: string | null;
  pages: PaginaFormulario[];
};

type Respuestas = Record<string, ValorRespuesta>;

/** Acento por encuesta: cada una puede tener identidad propia sin salirse del sistema. */
const ACENTO_POR_DEFECTO = "#6D3BF5";

function tieneValor(v: ValorRespuesta | undefined): boolean {
  if (!v) return false;
  switch (v.tipo) {
    case "texto":
      return v.texto.trim().length > 0;
    case "opciones":
      return v.opcionIds.length > 0;
    case "relacion":
      return v.pares.length > 0;
    case "fecha":
      return v.valor.trim().length > 0;
    default:
      return true;
  }
}

/**
 * FORMULARIO DE ENCUESTA, el mismo por enlace público y con sesión iniciada.
 *
 * Se recorre por pasos -un bloque por pantalla- en vez de como una lista
 * larga: una evaluación de cuatro guías clínicas en una sola página se
 * abandona a la mitad, y la tasa de abandono es justo lo que el módulo
 * quiere bajar. Cada bloque puede llevar su material embebido, así que la
 * guía que se evalúa se lee sin salir del formulario.
 *
 * La clave de respuesta NUNCA llega aquí: el servidor la quita antes de
 * mandar la encuesta (ver `configSinClave`).
 */
export function FormularioEncuesta({
  encuesta,
  onEnviar,
  nombreRequerido,
}: {
  encuesta: EncuestaFormulario;
  /** Devuelve un mensaje de error, o null si se guardó. */
  onEnviar: (respuestas: Respuestas, nombre: string | null) => Promise<string | null>;
  /** Enlace público sin sesión: se pide el nombre para poder atribuir la respuesta. */
  nombreRequerido: boolean;
}) {
  const [paso, setPaso] = useState(0);
  const [respuestas, setRespuestas] = useState<Respuestas>({});
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [enviando, startTransition] = useTransition();

  const acento = encuesta.themeColor || ACENTO_POR_DEFECTO;
  const totalPasos = encuesta.pages.length;
  const pagina = encuesta.pages[paso];
  const esUltimo = paso === totalPasos - 1;
  const progreso = totalPasos > 0 ? Math.round(((paso + 1) / totalPasos) * 100) : 0;

  const faltantes = useMemo(() => {
    if (!pagina) return [];
    return pagina.questions.filter((q) => q.isRequired && !tieneValor(respuestas[q.id])).map((q) => q.id);
  }, [pagina, respuestas]);

  function responder(id: string, valor: ValorRespuesta) {
    setRespuestas((prev) => ({ ...prev, [id]: valor }));
    setError(null);
  }

  function avanzar() {
    if (faltantes.length > 0) {
      setError("Responde las preguntas obligatorias de este bloque para continuar.");
      document.getElementById(`pregunta-${faltantes[0]}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setError(null);
    if (esUltimo) {
      if (nombreRequerido && nombre.trim().length < 3) {
        setError("Escribe tu nombre para registrar la respuesta.");
        return;
      }
      startTransition(async () => {
        const problema = await onEnviar(respuestas, nombreRequerido ? nombre.trim() : null);
        if (problema) setError(problema);
        else setEnviado(true);
      });
      return;
    }
    setPaso((p) => p + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (enviado) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
          <span
            className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl text-white shadow-lg"
            style={{ backgroundColor: acento, boxShadow: `0 24px 60px -24px ${acento}` }}
          >
            <CheckCircle2 className="h-10 w-10" strokeWidth={2} aria-hidden="true" />
          </span>
          <h2 className="mt-7 font-display text-3xl font-extrabold tracking-tight text-foreground">¡Listo!</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
            {encuesta.thankYouMessage || "Tu respuesta quedó registrada. Gracias por tomarte el tiempo."}
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen pb-24">
        {/* Barra de progreso fija: siempre se sabe cuánto falta. */}
        <div className="sticky top-0 z-20 border-b border-border/50 bg-background/85 backdrop-blur-xl">
          <div className="h-1 w-full bg-muted">
            <motion.div
              className="h-full"
              style={{ backgroundColor: acento }}
              animate={{ width: `${progreso}%` }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-2.5">
            <p className="truncate text-[13px] font-semibold text-foreground">{pagina?.title ?? encuesta.title}</p>
            <p className="shrink-0 text-[12px] text-muted-foreground">
              Paso {paso + 1} de {totalPasos}
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-3xl space-y-5 px-4 pt-6">
          {/* Portada + presentación, solo en el primer paso. */}
          {paso === 0 && (
            <>
              {encuesta.coverImageUrl && (
                <div className="surface-lumen overflow-hidden p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={encuesta.coverImageUrl} alt="" className="w-full rounded-xl object-cover" />
                </div>
              )}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="relative overflow-hidden rounded-3xl p-8 text-center text-white shadow-xl"
                style={{
                  backgroundImage: `linear-gradient(150deg, ${acento}, color-mix(in oklch, ${acento} 62%, black))`,
                  boxShadow: `0 30px 70px -32px ${acento}`,
                }}
              >
                <div
                  className="pointer-events-none absolute inset-0 opacity-25"
                  style={{
                    backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,.5) 1px, transparent 0)",
                    backgroundSize: "22px 22px",
                  }}
                />
                <div className="relative">
                  <h1 className="font-display text-[clamp(1.5rem,4vw,2rem)] font-extrabold leading-tight">
                    {encuesta.title}
                  </h1>
                  {encuesta.description && (
                    <p className="mx-auto mt-3 max-w-xl text-[14px] leading-relaxed text-white/85">
                      {encuesta.description}
                    </p>
                  )}
                  {encuesta.estimatedMinutes && (
                    <span className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3.5 py-1.5 text-[13px] font-semibold backdrop-blur">
                      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                      Aprox. {encuesta.estimatedMinutes} min
                    </span>
                  )}
                </div>
              </motion.div>
            </>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={pagina?.id ?? paso}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-5"
            >
              {pagina && (
                <div className="surface-lumen p-6">
                  <p
                    className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em]"
                    style={{ color: acento }}
                  >
                    <span className="h-px w-6" style={{ backgroundColor: acento }} />
                    {pagina.title}
                  </p>
                  <h2 className="mt-2 font-display text-xl font-extrabold tracking-tight text-foreground">
                    {pagina.title}
                  </h2>
                  {pagina.description && (
                    <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{pagina.description}</p>
                  )}

                  {/* Material del bloque, embebido: la guía se lee aquí mismo. */}
                  {pagina.attachmentUrl && (
                    <div className="mt-5 overflow-hidden rounded-2xl border border-border/60">
                      <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-muted/40 px-4 py-2.5">
                        <span className="flex min-w-0 items-center gap-2 text-[12px] font-semibold text-foreground">
                          <FileText className="h-4 w-4 shrink-0" style={{ color: acento }} aria-hidden="true" />
                          <span className="truncate">{pagina.attachmentName ?? "Material de apoyo"}</span>
                        </span>
                        <a
                          href={pagina.attachmentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="shrink-0 text-[12px] font-semibold hover:underline"
                          style={{ color: acento }}
                        >
                          Abrir aparte
                        </a>
                      </div>
                      <iframe
                        src={pagina.attachmentUrl}
                        title={pagina.attachmentName ?? "Material de apoyo"}
                        className="h-[460px] w-full bg-white"
                      />
                    </div>
                  )}

                  <div className="mt-6 space-y-6">
                    {pagina.questions.map((q, i) => (
                      <Pregunta
                        key={q.id}
                        numero={i + 1}
                        pregunta={q}
                        valor={respuestas[q.id]}
                        onResponder={(v) => responder(q.id, v)}
                        acento={acento}
                        resaltarFalta={error !== null && faltantes.includes(q.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Nombre, solo cuando se responde por enlace sin sesión. */}
              {esUltimo && nombreRequerido && (
                <div className="surface-lumen p-6">
                  <label htmlFor="nombre-encuestado" className="text-[13px] font-semibold text-foreground">
                    ¿Quién responde? <span className="text-destructive">*</span>
                  </label>
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    Se usa para dejar constancia de tu participación.
                  </p>
                  <input
                    id="nombre-encuestado"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Nombres y apellidos"
                    className="mt-3 h-11 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none transition-shadow focus:ring-2"
                    style={{ boxShadow: nombre ? `0 0 0 1px ${acento}33` : undefined }}
                  />
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {error && (
            <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={() => {
                setPaso((p) => Math.max(0, p - 1));
                setError(null);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              disabled={paso === 0 || enviando}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-card/70 px-4 py-2.5 text-[13px] font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Atrás
            </button>

            <button
              type="button"
              onClick={avanzar}
              disabled={enviando}
              className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-[14px] font-bold text-white shadow-lg transition-transform hover:translate-y-[-1px] disabled:pointer-events-none disabled:opacity-60"
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
                  Enviar respuesta
                </>
              ) : (
                <>
                  Siguiente
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </MotionConfig>
  );
}

// ---------------------------------------------------------------- pregunta

function Pregunta({
  numero,
  pregunta,
  valor,
  onResponder,
  acento,
  resaltarFalta,
}: {
  numero: number;
  pregunta: PreguntaFormulario;
  valor: ValorRespuesta | undefined;
  onResponder: (v: ValorRespuesta) => void;
  acento: string;
  resaltarFalta: boolean;
}) {
  const config: ConfigPregunta = leerConfig(pregunta.config);

  return (
    <div
      id={`pregunta-${pregunta.id}`}
      className={cn(
        "scroll-mt-24 rounded-2xl p-1 transition-colors",
        resaltarFalta && "bg-destructive/5 ring-1 ring-destructive/30"
      )}
    >
      <p className="text-[15px] font-semibold leading-snug text-foreground">
        <span className="mr-1.5 font-bold" style={{ color: acento }}>
          {numero}.
        </span>
        {pregunta.prompt}
        {pregunta.isRequired && <span className="ml-1 text-destructive">*</span>}
      </p>
      {pregunta.description && (
        <p className="ml-5 mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{pregunta.description}</p>
      )}
      {pregunta.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={pregunta.imageUrl} alt="" className="ml-5 mt-3 max-h-64 rounded-xl border border-border/60" />
      )}

      <div className="ml-5 mt-3">
        <CampoRespuesta pregunta={pregunta} config={config} valor={valor} onResponder={onResponder} acento={acento} />
      </div>
    </div>
  );
}

function CampoRespuesta({
  pregunta,
  config,
  valor,
  onResponder,
  acento,
}: {
  pregunta: PreguntaFormulario;
  config: ConfigPregunta;
  valor: ValorRespuesta | undefined;
  onResponder: (v: ValorRespuesta) => void;
  acento: string;
}) {
  const claseCampo =
    "w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none transition-shadow focus:ring-2 focus:ring-offset-0";

  switch (pregunta.type) {
    case "SHORT_TEXT":
      return (
        <input
          value={valor?.tipo === "texto" ? valor.texto : ""}
          onChange={(e) => onResponder({ tipo: "texto", texto: e.target.value })}
          placeholder="Tu respuesta"
          className={claseCampo}
        />
      );

    case "LONG_TEXT":
      return (
        <textarea
          value={valor?.tipo === "texto" ? valor.texto : ""}
          onChange={(e) => onResponder({ tipo: "texto", texto: e.target.value })}
          placeholder="Tu respuesta"
          rows={4}
          className={cn(claseCampo, "resize-y")}
        />
      );

    case "NUMBER":
      return (
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={valor?.tipo === "numero" ? valor.valor : ""}
            min={config.minimo}
            max={config.maximo}
            onChange={(e) => onResponder({ tipo: "numero", valor: Number(e.target.value) })}
            className={cn(claseCampo, "max-w-[200px]")}
          />
          {config.unidad && <span className="text-sm text-muted-foreground">{config.unidad}</span>}
        </div>
      );

    case "DATE":
      return (
        <input
          type="date"
          value={valor?.tipo === "fecha" ? valor.valor : ""}
          onChange={(e) => onResponder({ tipo: "fecha", valor: e.target.value })}
          className={cn(claseCampo, "max-w-[220px]")}
        />
      );

    case "SCALE": {
      const min = config.escalaMin ?? 1;
      const max = config.escalaMax ?? 5;
      const elegido = valor?.tipo === "escala" ? valor.valor : null;

      // Puntuación por estrellas: mismas respuestas (un número del rango),
      // otra presentación. Las estrellas se llenan hasta la elegida.
      if (config.escalaEstilo === "estrellas") {
        return (
          <div>
            <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Puntuación por estrellas">
              {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((n) => {
                const llena = elegido !== null && n <= elegido;
                return (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={elegido === n}
                    aria-label={`${n} de ${max}`}
                    onClick={() => onResponder({ tipo: "escala", valor: n })}
                    className="rounded-lg p-1 transition-transform hover:scale-110 focus-visible:outline focus-visible:outline-2"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-10 w-10"
                      fill={llena ? acento : "none"}
                      stroke={llena ? acento : "var(--muted-foreground)"}
                      strokeWidth={llena ? 0 : 1.6}
                      aria-hidden="true"
                    >
                      <path d="M12 2.6l2.9 6.03 6.6.87-4.85 4.6 1.23 6.55L12 17.5l-5.88 3.15 1.23-6.55L2.5 9.5l6.6-.87L12 2.6z" />
                    </svg>
                  </button>
                );
              })}
              {elegido !== null && (
                <span className="ml-2 text-[14px] font-bold tabular-nums" style={{ color: acento }}>
                  {elegido}/{max}
                </span>
              )}
            </div>
            {(config.etiquetaMin || config.etiquetaMax) && (
              <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
                <span>{config.etiquetaMin}</span>
                <span>{config.etiquetaMax}</span>
              </div>
            )}
          </div>
        );
      }

      return (
        <div>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((n) => {
              const activo = elegido === n;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => onResponder({ tipo: "escala", valor: n })}
                  className={cn(
                    "h-12 w-12 rounded-xl border text-[15px] font-bold transition-all",
                    activo
                      ? "border-transparent text-white shadow-md"
                      : "border-border/60 bg-card/70 text-muted-foreground hover:border-foreground/25 hover:text-foreground"
                  )}
                  style={activo ? { backgroundColor: acento, boxShadow: `0 10px 24px -12px ${acento}` } : undefined}
                >
                  {n}
                </button>
              );
            })}
          </div>
          {(config.etiquetaMin || config.etiquetaMax) && (
            <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
              <span>{config.etiquetaMin}</span>
              <span>{config.etiquetaMax}</span>
            </div>
          )}
        </div>
      );
    }

    case "YES_NO":
    case "SINGLE_CHOICE": {
      const opciones =
        pregunta.type === "YES_NO" && !config.opciones?.length
          ? [
              { id: "si", texto: "Sí" },
              { id: "no", texto: "No" },
            ]
          : config.opciones ?? [];
      const elegida = valor?.tipo === "opcion" ? valor.opcionId : null;
      return (
        <div className="space-y-2">
          {opciones.map((o) => {
            const activo = elegida === o.id;
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => onResponder({ tipo: "opcion", opcionId: o.id })}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-all",
                  activo
                    ? "border-transparent bg-card shadow-md"
                    : "border-border/60 bg-card/60 hover:border-foreground/20"
                )}
                style={activo ? { boxShadow: `0 0 0 2px ${acento}, 0 12px 28px -16px ${acento}` } : undefined}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                    activo ? "border-transparent" : "border-muted-foreground/40"
                  )}
                  style={activo ? { backgroundColor: acento } : undefined}
                >
                  {activo && <span className="h-2 w-2 rounded-full bg-white" />}
                </span>
                <span className={cn("flex-1", activo ? "font-semibold text-foreground" : "text-foreground/80")}>
                  {o.texto}
                </span>
              </button>
            );
          })}
        </div>
      );
    }

    case "MULTIPLE_CHOICE": {
      const elegidas = valor?.tipo === "opciones" ? valor.opcionIds : [];
      return (
        <div className="space-y-2">
          {(config.opciones ?? []).map((o) => {
            const activo = elegidas.includes(o.id);
            return (
              <button
                key={o.id}
                type="button"
                onClick={() =>
                  onResponder({
                    tipo: "opciones",
                    opcionIds: activo ? elegidas.filter((x) => x !== o.id) : [...elegidas, o.id],
                  })
                }
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-all",
                  activo ? "border-transparent bg-card shadow-md" : "border-border/60 bg-card/60 hover:border-foreground/20"
                )}
                style={activo ? { boxShadow: `0 0 0 2px ${acento}, 0 12px 28px -16px ${acento}` } : undefined}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
                    activo ? "border-transparent" : "border-muted-foreground/40"
                  )}
                  style={activo ? { backgroundColor: acento } : undefined}
                >
                  {activo && <CheckCircle2 className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                </span>
                <span className={cn("flex-1", activo ? "font-semibold text-foreground" : "text-foreground/80")}>
                  {o.texto}
                </span>
              </button>
            );
          })}
        </div>
      );
    }

    case "IMAGE_CHOICE": {
      const elegida = valor?.tipo === "opcion" ? valor.opcionId : null;
      return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {(config.opciones ?? []).map((o) => {
            const activo = elegida === o.id;
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => onResponder({ tipo: "opcion", opcionId: o.id })}
                className={cn(
                  "overflow-hidden rounded-xl border text-left transition-all",
                  activo ? "border-transparent shadow-lg" : "border-border/60 hover:border-foreground/25"
                )}
                style={activo ? { boxShadow: `0 0 0 2px ${acento}, 0 16px 34px -18px ${acento}` } : undefined}
              >
                {o.imagenUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={o.imagenUrl} alt="" className="h-28 w-full object-cover" />
                )}
                <span
                  className={cn(
                    "block px-3 py-2 text-[13px]",
                    activo ? "font-semibold text-foreground" : "text-foreground/80"
                  )}
                >
                  {o.texto}
                </span>
              </button>
            );
          })}
        </div>
      );
    }

    case "MATCHING":
      return (
        <Relacionar
          config={config}
          valor={valor?.tipo === "relacion" ? valor.pares : []}
          onResponder={(pares) => onResponder({ tipo: "relacion", pares })}
          acento={acento}
        />
      );

    default:
      return null;
  }
}

/**
 * Relacionar elementos con grupos. Se resuelve tocando -elemento, luego
 * grupo- y no arrastrando: el arrastre no funciona en móvil sin librería, y
 * buena parte del personal responde desde el teléfono.
 */
function Relacionar({
  config,
  valor,
  onResponder,
  acento,
}: {
  config: ConfigPregunta;
  valor: { elementoId: string; grupoId: string }[];
  onResponder: (pares: { elementoId: string; grupoId: string }[]) => void;
  acento: string;
}) {
  const [elegido, setElegido] = useState<string | null>(null);
  const elementos = config.opciones ?? [];
  const grupos = config.grupos ?? [];
  const asignado = new Map(valor.map((p) => [p.elementoId, p.grupoId]));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {elementos.map((el) => {
          const grupoId = asignado.get(el.id);
          const grupo = grupos.find((g) => g.id === grupoId);
          const activo = elegido === el.id;
          return (
            <button
              key={el.id}
              type="button"
              onClick={() => setElegido(activo ? null : el.id)}
              className={cn(
                "rounded-full border px-3.5 py-2 text-[13px] font-medium transition-all",
                activo && "scale-[1.03]",
                grupo ? "text-white border-transparent" : "border-border/60 bg-card/70 text-foreground/85"
              )}
              style={{
                backgroundColor: grupo?.color ?? undefined,
                boxShadow: activo ? `0 0 0 2px ${acento}` : undefined,
              }}
            >
              {el.texto}
            </button>
          );
        })}
      </div>

      <p className="text-[12px] text-muted-foreground">
        {elegido ? "Ahora toca el grupo al que pertenece." : "Toca un elemento y luego su grupo."}
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {grupos.map((g) => {
          const suyos = valor.filter((p) => p.grupoId === g.id);
          return (
            <button
              key={g.id}
              type="button"
              disabled={!elegido}
              onClick={() => {
                if (!elegido) return;
                onResponder([...valor.filter((p) => p.elementoId !== elegido), { elementoId: elegido, grupoId: g.id }]);
                setElegido(null);
              }}
              className={cn(
                "rounded-2xl border p-4 text-left transition-all",
                elegido ? "border-dashed hover:scale-[1.01]" : "border-border/60",
                "bg-card/60"
              )}
              style={elegido ? { borderColor: g.color ?? acento } : undefined}
            >
              <span
                className="inline-block rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white"
                style={{ backgroundColor: g.color ?? acento }}
              >
                {g.titulo}
              </span>
              {g.subtitulo && <p className="mt-1.5 text-[12px] text-muted-foreground">{g.subtitulo}</p>}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {suyos.length === 0 ? (
                  <span className="text-[12px] text-muted-foreground/70">Sin elementos</span>
                ) : (
                  suyos.map((p) => {
                    const el = elementos.find((e) => e.id === p.elementoId);
                    return (
                      <span
                        key={p.elementoId}
                        className="rounded-full bg-foreground/8 px-2 py-0.5 text-[11px] font-medium text-foreground"
                      >
                        {el?.texto}
                      </span>
                    );
                  })
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
