"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Award,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Clock,
  Flag,
  Loader2,
  Lightbulb,
  ListChecks,
  NotebookPen,
  RefreshCw,
  Send,
  Target,
  X,
  XCircle,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  guardarRespuestaBorradorAction,
  submitQuizAttemptAction,
  type QuizSubmitState,
} from "@/app/aula/[courseId]/quiz/[quizId]/actions";
import { PanelEvaluacion, RespuestaGuardada } from "@/components/aula/panel-evaluacion";
import type { NotaRepasoItem, RespuestaBorrador } from "@/lib/aula";
import type { QuestionType } from "@prisma/client";

const initialState: QuizSubmitState = { error: null };

/** Lo que el estudiante lleva marcado en una pregunta, en memoria. */
type RespuestaLocal = { opciones: string[]; texto: string; marcada: boolean };

/** Estado del autoguardado, tal y como se le muestra al estudiante. */
type EstadoGuardado = "inactivo" | "guardando" | "guardado" | "error";

type OptionView = { id: string; text: string };
type QuestionView = {
  id: string;
  type: QuestionType;
  statement: string;
  imageUrl?: string | null;
  /** Área temática del enunciado (SST, Talento Humano…), si está definida. */
  area?: string | null;
  score: number;
  options: OptionView[];
};

/** Chip de metadato de la cabecera. */
function Chip({ icon: Icon, children }: { icon: typeof Target; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[12px] text-white/90 backdrop-blur">
      <Icon className="h-3.5 w-3.5" />
      {children}
    </span>
  );
}

/**
 * Nota de repaso: qué era lo correcto según el intento anterior fallido. Solo
 * llega al cliente cuando ya existe un intento calificado (ver getNotaRepaso).
 */
function NotaRepaso({ nota }: { nota: NotaRepasoItem[] }) {
  return (
    <details className="group surface-glass overflow-hidden border-warning/30 p-5">
      <summary className="flex cursor-pointer list-none items-center gap-2.5">
        <NotebookPen className="h-5 w-5 shrink-0 text-warning-foreground" />
        <span className="min-w-0 flex-1 text-[15px] font-semibold text-foreground">
          Nota de repaso — respuestas correctas del intento anterior
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-4 space-y-3">
        {nota.map((n) => (
          <div key={n.questionId} className="rounded-xl border border-border bg-card/60 p-4">
            <p className="break-words text-[13px] font-medium text-foreground">{n.statement}</p>
            {n.correctas.length > 0 &&
              n.correctas.map((texto) => (
                <p key={texto} className="mt-1.5 flex items-start gap-1.5 text-[13px] text-success">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span className="min-w-0 break-words">{texto}</span>
                </p>
              ))}
            {n.respuestaEsperada && (
              <p className="mt-1.5 break-words text-[13px] text-success">{n.respuestaEsperada}</p>
            )}
            {n.explanation && <p className="mt-1 break-words text-[12.5px] text-muted-foreground">{n.explanation}</p>}
          </div>
        ))}
      </div>
    </details>
  );
}

export function QuizTakingForm({
  courseId,
  quizId,
  title,
  description,
  passingScore,
  timeLimitMinutes,
  attemptNumber,
  maxAttempts,
  questions,
  initiallyPassed,
  initialBestScore,
  initialAttemptsRemaining,
  notaRepaso = [],
  borrador = [],
  area,
  tutor,
  fechaLimite,
}: {
  courseId: string;
  quizId: string;
  title: string;
  description: string | null;
  passingScore: number;
  timeLimitMinutes: number | null;
  attemptNumber: number;
  maxAttempts: number;
  questions: QuestionView[];
  initiallyPassed: boolean;
  initialBestScore: number | null;
  initialAttemptsRemaining: number;
  /** Respuestas correctas del intento anterior fallido (vacío en el primero). */
  notaRepaso?: NotaRepasoItem[];
  /** Lo que ya llevaba respondido en este intento, recuperado del servidor. */
  borrador?: RespuestaBorrador[];
  /** Ficha del curso para el panel lateral. */
  area: string | null;
  tutor: string;
  fechaLimite: Date | null;
}) {
  const router = useRouter();
  const action = submitQuizAttemptAction.bind(null, courseId, quizId);
  const [state, formAction, pending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const [secondsLeft, setSecondsLeft] = useState(timeLimitMinutes ? timeLimitMinutes * 60 : null);

  /**
   * Estado de las respuestas. Los campos son controlados, no se leen del DOM:
   * el stepper, el contador y el autoguardado necesitan saber qué hay
   * respondido en cada momento, y consultar el formulario con querySelector
   * en cada tecla no sirve para eso.
   *
   * Arranca con el borrador que devuelve el servidor, así que recargar la
   * página o entrar desde otro equipo recupera lo ya contestado.
   */
  const [respuestas, setRespuestas] = useState<Record<string, RespuestaLocal>>(() => {
    const inicial: Record<string, RespuestaLocal> = {};
    for (const q of questions) {
      const guardada = borrador.find((b) => b.questionId === q.id);
      inicial[q.id] = {
        opciones: guardada?.selectedOptionIds ?? [],
        texto: guardada?.textAnswer ?? "",
        marcada: guardada?.flagged ?? false,
      };
    }
    return inicial;
  });

  const [guardado, setGuardado] = useState<EstadoGuardado>("inactivo");
  const temporizadores = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pendientes = useRef<Record<string, RespuestaLocal>>({});
  /**
   * Los guardados se encadenan uno tras otro en vez de lanzarse en paralelo.
   * El primero es el que crea el intento; si dos salieran a la vez, ambos
   * verían "cero intentos usados" y crearían uno cada uno, repartiendo las
   * respuestas entre dos intentos y gastando dos de los diez disponibles.
   */
  const cola = useRef<Promise<unknown>>(Promise.resolve());

  function encolarGuardado(questionId: string, valor: RespuestaLocal) {
    pendientes.current[questionId] = valor;
    setGuardado("guardando");
    cola.current = cola.current
      .then(async () => {
        const v = pendientes.current[questionId];
        const r = await guardarRespuestaBorradorAction(courseId, quizId, questionId, {
          selectedOptionIds: v.opciones,
          textAnswer: v.texto || null,
          flagged: v.marcada,
        });
        setGuardado(r.ok ? "guardado" : "error");
      })
      .catch(() => setGuardado("error"));
    return cola.current;
  }

  /**
   * Marcar una opción o una pregunta es un acto discreto: se guarda al
   * instante. Solo el texto libre espera 800 ms desde la última tecla, porque
   * si no dispararía una petición por carácter.
   *
   * Esta distinción importa: con espera para todo, cerrar la pestaña justo
   * después de responder perdía esa respuesta.
   */
  function actualizar(questionId: string, cambio: Partial<RespuestaLocal>) {
    // El valor nuevo se calcula AQUÍ, no dentro del updater de setState.
    // React puede ejecutar el updater más tarde, durante el render; si los
    // efectos (registrar lo pendiente, programar el guardado) vivieran ahí,
    // un blur inmediatamente posterior no encontraría nada que vaciar y la
    // respuesta se perdía al recargar. Es exactamente lo que pasaba con el
    // texto libre.
    const valor = { ...respuestas[questionId], ...cambio };
    setRespuestas((previo) => ({ ...previo, [questionId]: valor }));

    pendientes.current[questionId] = valor;
    clearTimeout(temporizadores.current[questionId]);

    const soloTexto = Object.keys(cambio).length === 1 && "texto" in cambio;
    if (soloTexto) {
      temporizadores.current[questionId] = setTimeout(() => {
        delete temporizadores.current[questionId];
        void encolarGuardado(questionId, pendientes.current[questionId]);
      }, 800);
    } else {
      void encolarGuardado(questionId, valor);
    }
  }

  /** Envía ya lo que estuviera esperando su turno. */
  function vaciarPendientes() {
    for (const [questionId, timer] of Object.entries(temporizadores.current)) {
      clearTimeout(timer);
      const v = pendientes.current[questionId];
      if (v) void encolarGuardado(questionId, v);
    }
    temporizadores.current = {};
  }

  // Al ocultarse la pestaña (cambiar de app, cerrar, bloquear el móvil) se
  // vacía lo pendiente. visibilitychange es más fiable que beforeunload, que
  // los navegadores móviles se saltan.
  useEffect(() => {
    function alOcultar() {
      if (document.visibilityState === "hidden") vaciarPendientes();
    }
    document.addEventListener("visibilitychange", alOcultar);
    return () => document.removeEventListener("visibilitychange", alOcultar);
  });

  /** Reintento manual: reenvía todo lo que haya, sin esperar la espera. */
  async function reintentarGuardado() {
    setGuardado("guardando");
    const resultados = await Promise.all(
      questions.map((q) =>
        guardarRespuestaBorradorAction(courseId, quizId, q.id, {
          selectedOptionIds: respuestas[q.id].opciones,
          textAnswer: respuestas[q.id].texto || null,
          flagged: respuestas[q.id].marcada,
        })
      )
    );
    setGuardado(resultados.every((r) => r.ok) ? "guardado" : "error");
  }

  const estaRespondida = (q: QuestionView) =>
    q.type === "OPEN_TEXT" ? respuestas[q.id].texto.trim().length > 0 : respuestas[q.id].opciones.length > 0;
  const respondidas = questions.filter(estaRespondida).length;
  const sinResponder = questions.filter((q) => !estaRespondida(q));
  const marcadas = questions.filter((q) => respuestas[q.id].marcada);
  const [confirmando, setConfirmando] = useState(false);
  const [indiceActivo, setIndiceActivo] = useState(0);

  /** Lleva el foco y la vista a una pregunta. */
  function irA(indice: number) {
    const destino = Math.min(Math.max(0, indice), questions.length - 1);
    setIndiceActivo(destino);
    const nodo = document.getElementById("pregunta-" + (destino + 1));
    nodo?.scrollIntoView({ behavior: "smooth", block: "start" });
    // El foco va al primer control de la pregunta: sin esto, quien navega con
    // teclado salta de vista pero sigue con el foco en el stepper.
    nodo?.querySelector<HTMLElement>("input, textarea, button")?.focus({ preventScroll: true });
  }

  // Ctrl+flecha salta de pregunta sin tocar el ratón. Ctrl y no la flecha
  // sola porque dentro de un textarea las flechas mueven el cursor.
  useEffect(() => {
    function alPulsar(e: KeyboardEvent) {
      if (!e.ctrlKey) return;
      if (e.key === "ArrowRight") { e.preventDefault(); irA(indiceActivo + 1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); irA(indiceActivo - 1); }
    }
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  });

  useEffect(() => {
    if (secondsLeft === null || state.result) return;
    if (secondsLeft <= 0) {
      formRef.current?.requestSubmit();
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((s) => (s === null ? null : s - 1)), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft, state.result]);

  // Este cuestionario era lo último que faltaba para completar el curso: en vez
  // del panel genérico de "aprobado", el momento real es la revelación del
  // certificado.
  const certificateId = state.result?.certificateId;
  useEffect(() => {
    if (certificateId) router.push(`/mi-aula/certificados/${certificateId}?justIssued=1`);
  }, [certificateId, router]);

  if (certificateId) {
    return (
      <div className="surface-glass flex flex-col items-center gap-3 p-10 text-center">
        <Award className="h-10 w-10 animate-pulse text-warning-foreground" />
        <p className="text-sm font-medium text-muted-foreground">Preparando tu certificado...</p>
      </div>
    );
  }

  // `state.result` (local) tiene prioridad sobre los props "initial*": enviar
  // dispara revalidatePath y el servidor devolvería initiallyPassed=true,
  // borrando la pantalla de resultado antes de que se lea.
  if (!state.result && initiallyPassed) {
    return (
      <div className="surface-glass flex flex-col items-center gap-2 p-10 text-center">
        <CheckCircle2 className="h-12 w-12 text-success" />
        <h1 className="font-display text-2xl font-extrabold text-foreground">Ya aprobaste esta evaluación</h1>
        <p className="text-sm text-muted-foreground">
          Tu mejor puntaje fue <span className="font-semibold text-foreground">{initialBestScore}%</span> (mínimo{" "}
          {passingScore}%).
        </p>
        <Link href={`/aula/${courseId}`} className={cn(buttonVariants({ variant: "outline" }), "mt-2")}>
          Volver al aula
        </Link>
      </div>
    );
  }

  if (!state.result && initialAttemptsRemaining <= 0) {
    return (
      <div className="space-y-5">
        <div className="surface-glass flex flex-col items-center gap-2 p-10 text-center">
          <XCircle className="h-12 w-12 text-destructive" />
          <h1 className="font-display text-2xl font-extrabold text-foreground">Sin intentos disponibles</h1>
          <p className="text-sm text-muted-foreground">
            Usaste tus {maxAttempts} intentos sin alcanzar el mínimo de {passingScore}%. Comunícate con Talento
            Humano.
          </p>
          <Link href={`/aula/${courseId}`} className={cn(buttonVariants({ variant: "outline" }), "mt-2")}>
            Volver al aula
          </Link>
        </div>
        {notaRepaso.length > 0 && <NotaRepaso nota={notaRepaso} />}
      </div>
    );
  }

  // ---------- Pantalla de resultado + revisión ----------
  if (state.result) {
    const { score, passed, attemptsRemaining, feedback } = state.result;
    const feedbackByQuestion = new Map(feedback?.map((f) => [f.questionId, f]) ?? []);

    return (
      <div className="space-y-5">
        <section
          className={cn(
            "relative overflow-hidden rounded-2xl border p-6 sm:p-7",
            passed ? "border-success/30" : "border-destructive/30"
          )}
          style={{
            backgroundImage: `linear-gradient(150deg, color-mix(in oklch, var(--${passed ? "success" : "destructive"}) 20%, var(--card)), var(--card))`,
          }}
        >
          <div className="flex flex-wrap items-center gap-4">
            <span
              className={cn(
                "grid h-16 w-16 shrink-0 place-items-center rounded-2xl",
                passed ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
              )}
            >
              {passed ? <CheckCircle2 className="h-8 w-8" /> : <XCircle className="h-8 w-8" />}
            </span>
            <div className="min-w-0">
              <h2 className="font-display text-[22px] font-extrabold text-foreground">
                {passed ? "¡Aprobaste!" : "No alcanzaste el mínimo"}
              </h2>
              <p className="text-[14px] text-muted-foreground">
                Obtuviste{" "}
                <b className={passed ? "text-success" : "text-destructive"}>{score}%</b> · Mínimo requerido:{" "}
                {passingScore}%
              </p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-[12px] text-muted-foreground">
                Intento {attemptNumber} de {maxAttempts}
              </p>
              {!passed && attemptsRemaining > 0 && (
                <p className="text-[12px] text-muted-foreground">
                  Te {attemptsRemaining === 1 ? "queda" : "quedan"} {attemptsRemaining}{" "}
                  {attemptsRemaining === 1 ? "intento" : "intentos"}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Revisión pregunta por pregunta. */}
        {feedback && (
          <div className="space-y-4">
            {questions.map((question, index) => {
              const f = feedbackByQuestion.get(question.id);
              if (!f) return null;
              const abierta = f.isOpen;
              return (
                <article key={question.id} className="surface-glass p-5 sm:p-6">
                  <div className="flex gap-3">
                    <span
                      className={cn(
                        "grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[13px] font-bold",
                        abierta
                          ? "bg-primary/15 text-primary"
                          : f.isCorrect
                            ? "bg-success/20 text-success"
                            : "bg-destructive/20 text-destructive"
                      )}
                    >
                      {abierta ? index + 1 : f.isCorrect ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                    </span>
                    <p className="min-w-0 flex-1 break-words text-[15px] font-semibold leading-relaxed text-foreground">
                      {question.statement}
                    </p>
                  </div>

                  <div className="mt-4 space-y-2.5 sm:pl-10">
                    {question.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={question.imageUrl}
                        alt="Imagen de apoyo del enunciado"
                        className="max-h-56 w-auto rounded-xl border border-border object-contain"
                      />
                    )}

                    {abierta ? (
                      <>
                        <div className="rounded-xl border border-border bg-card/60 p-4">
                          <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Tu respuesta
                          </p>
                          <p className="mt-1.5 break-words text-[14px] leading-relaxed text-foreground">
                            {f.textAnswer?.trim() || "— sin responder —"}
                          </p>
                        </div>
                        {f.expectedAnswer && (
                          <div className="rounded-xl border border-success/25 bg-success/5 p-4">
                            <p className="text-[12px] font-semibold uppercase tracking-wider text-success">
                              Respuesta esperada
                            </p>
                            <p className="mt-1.5 break-words text-[14px] leading-relaxed text-foreground">
                              {f.expectedAnswer}
                            </p>
                          </div>
                        )}
                        <p className="text-[12.5px] text-muted-foreground">
                          Las preguntas abiertas no suman al puntaje automático: las revisa Talento Humano.
                        </p>
                      </>
                    ) : (
                      question.options.map((option) => {
                        const esCorrecta = f.correctOptionIds.includes(option.id);
                        const esElegida = f.selectedOptionIds?.includes(option.id) ?? false;
                        return (
                          <div
                            key={option.id}
                            className={cn(
                              "flex items-center gap-3 rounded-xl border px-4 py-3 text-[14px]",
                              esCorrecta
                                ? "border-success/50 bg-success/10 text-foreground"
                                : esElegida
                                  ? "border-destructive/50 bg-destructive/10 text-foreground"
                                  : "border-border bg-card/40 text-muted-foreground"
                            )}
                          >
                            {esCorrecta ? (
                              <Check className="h-4 w-4 shrink-0 text-success" />
                            ) : esElegida ? (
                              <X className="h-4 w-4 shrink-0 text-destructive" />
                            ) : (
                              <span className="h-4 w-4 shrink-0" />
                            )}
                            <span className="min-w-0 break-words">{option.text}</span>
                            {esCorrecta && (
                              <span className="ml-auto shrink-0 text-[11px] font-semibold text-success">Correcta</span>
                            )}
                            {esElegida && !esCorrecta && (
                              <span className="ml-auto shrink-0 text-[11px] font-semibold text-destructive">
                                Tu respuesta
                              </span>
                            )}
                          </div>
                        );
                      })
                    )}

                    {f.explanation && (
                      <div className="flex gap-2 rounded-xl border border-primary/25 bg-primary/5 p-3.5">
                        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <p className="min-w-0 break-words text-[13px] leading-relaxed text-foreground/90">
                          {f.explanation}
                        </p>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Link href={`/aula/${courseId}`} className={buttonVariants({ variant: "outline" })}>
            Volver al aula
          </Link>
          {!passed && attemptsRemaining > 0 && (
            <Button type="button" onClick={() => window.location.reload()} className="gap-1.5">
              Reintentar evaluación <RefreshCw className="h-4 w-4" />
            </Button>
          )}
          {!passed && attemptsRemaining <= 0 && (
            <p className="text-sm text-destructive">Has agotado tus intentos. Comunícate con Talento Humano.</p>
          )}
        </div>
      </div>
    );
  }

  // ---------- Formulario del intento ----------
  return (
    <form id="form-evaluacion" ref={formRef} action={formAction} className="space-y-5">
      {/* Cabecera */}
      <section className="hud-hero noise-overlay accent-student relative overflow-hidden p-6 sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[var(--accent)]/25 blur-[90px]" />
        <div className="relative">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Distintivo de intento en curso: el punto late para decir que la
                evaluación está viva, no que haya cuenta atrás. */}
            <span className="chip-glass">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              En progreso
            </span>
            {secondsLeft !== null && (
              <span className="chip-glass">
                <Clock className="h-3.5 w-3.5" />
                {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
              </span>
            )}
          </div>
          <h1 className="mt-4 font-display text-2xl font-extrabold tracking-tight text-white">{title}</h1>
          {description && (
            <p className="mt-2 max-w-[560px] break-words text-[13px] leading-relaxed text-white/70">{description}</p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <Chip icon={RefreshCw}>
              Intento {attemptNumber} de {maxAttempts}
            </Chip>
            <Chip icon={Target}>Mínimo para aprobar: {passingScore}%</Chip>
            <Chip icon={ListChecks}>{questions.length} preguntas</Chip>
            {/* Solo si el cuestionario tiene límite configurado: inventar un
                "tiempo estimado" sería un dato que nadie ha decidido. */}
            {timeLimitMinutes !== null && <Chip icon={Clock}>Tiempo límite: {timeLimitMinutes} min</Chip>}
          </div>
        </div>
      </section>

      {notaRepaso.length > 0 && <NotaRepaso nota={notaRepaso} />}

      {/* A partir de aquí, dos columnas: preguntas y panel de apoyo. El panel
          se coloca DESPUÉS en el orden del documento y se sube con grid en
          pantallas anchas, para que quien navega con teclado o lector llegue
          antes a las preguntas que a la información de contexto. */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
      <div className="min-w-0 space-y-5">

      {/* Stepper: estado de cada pregunta y salto directo. Son botones reales,
          así que se recorren con Tab; Ctrl+flecha salta entre preguntas. */}
      <nav
        className="surface-glass flex flex-wrap items-center gap-3 px-4 py-3"
        aria-label="Progreso de la evaluación"
      >
        <span className="text-[12.5px] text-muted-foreground">Tu progreso</span>
        <ol className="flex flex-1 flex-wrap items-center gap-2">
          {questions.map((q, i) => {
            const estado = respuestas[q.id].marcada
              ? "marcada"
              : estaRespondida(q)
                ? "respondida"
                : "pendiente";
            return (
              <li key={q.id}>
                <button
                  type="button"
                  className="paso"
                  data-estado={estado}
                  aria-current={i === indiceActivo ? "step" : undefined}
                  onClick={() => irA(i)}
                  aria-label={
                    "Pregunta " +
                    (i + 1) +
                    " de " +
                    questions.length +
                    ": " +
                    (estado === "marcada"
                      ? "marcada para revisar"
                      : estado === "respondida"
                        ? "respondida"
                        : "sin responder")
                  }
                >
                  {i + 1}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Preguntas */}
      {questions.map((question, index) => (
        <article
          key={question.id}
          id={"pregunta-" + (index + 1)}
          className="surface-glass scroll-mt-4 p-5 sm:p-6"
          aria-label={"Pregunta " + (index + 1) + " de " + questions.length}
        >
          <div className="flex gap-3">
            {/* El número cambia a verde en cuanto la pregunta tiene respuesta:
                el estado se ve en la propia tarjeta, no solo en el stepper. */}
            <span
              className={cn(
                "grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold text-white",
                estaRespondida(question)
                  ? "bg-gradient-to-br from-[color-mix(in_oklch,var(--success)_80%,white)] to-[var(--success)]"
                  : "bg-gradient-to-br from-[var(--accent)] to-[color-mix(in_oklch,var(--accent)_60%,var(--navy))]"
              )}
            >
              {index + 1}
            </span>
            <p className="min-w-0 flex-1 break-words text-[15px] font-semibold leading-relaxed text-foreground">
              {question.statement}
            </p>
            {/* chip-glass NO sirve aquí: está pensado para el navy del hero y
                su texto es blanco, así que sobre la tarjeta clara quedaba
                invisible. */}
            {question.area && (
              <span className="shrink-0 rounded-md bg-[color-mix(in_oklch,var(--accent)_16%,transparent)] px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-[color-mix(in_oklch,var(--accent)_65%,var(--navy))]">
                {question.area}
              </span>
            )}
            <button
              type="button"
              onClick={() => actualizar(question.id, { marcada: !respuestas[question.id].marcada })}
              aria-pressed={respuestas[question.id].marcada}
              aria-label={
                respuestas[question.id].marcada ? "Quitar la marca de revisión" : "Marcar para revisar"
              }
              className={cn(
                "shrink-0 transition-colors",
                respuestas[question.id].marcada ? "text-warning" : "text-muted-foreground hover:text-warning"
              )}
            >
              <Flag className="h-4 w-4" fill={respuestas[question.id].marcada ? "currentColor" : "none"} />
            </button>
          </div>

          <div className="mt-4 sm:pl-10">
            {question.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={question.imageUrl}
                alt="Imagen de apoyo del enunciado"
                className="mb-3 max-h-72 w-auto rounded-xl border border-border object-contain"
              />
            )}

            {question.type === "OPEN_TEXT" ? (
              <div className="space-y-1.5">
                <textarea
                  name={`q_${question.id}_text`}
                  rows={4}
                  value={respuestas[question.id].texto}
                  onChange={(e) => actualizar(question.id, { texto: e.target.value })}
                  onBlur={vaciarPendientes}
                  placeholder="Escribe tu respuesta..."
                  aria-describedby={`ayuda-${question.id}`}
                  className="w-full resize-y rounded-xl border border-border bg-card/50 p-4 text-[14px] leading-relaxed text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-[var(--accent)]/50 focus-visible:ring-2 focus-visible:ring-[var(--accent)]/15"
                />
                <p id={`ayuda-${question.id}`} className="text-[11px] text-muted-foreground">
                  {respuestas[question.id].texto.trim().length} caracteres · se sugieren al menos 3 ideas claras.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {question.options.map((option) => (
                  <label
                    key={option.id}
                    className="group flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-card/40 px-4 py-3.5 transition-colors hover:border-[var(--accent)]/40 has-[:checked]:border-[var(--accent)]/60 has-[:checked]:bg-[var(--accent)]/10"
                  >
                    <span
                      className={cn(
                        "relative grid h-4 w-4 shrink-0 place-items-center border-2 border-muted-foreground/40 transition-colors group-has-[:checked]:border-[var(--accent)]",
                        question.type === "MULTIPLE_CHOICE" ? "rounded" : "rounded-full"
                      )}
                    >
                      <span
                        className={cn(
                          "h-2 w-2 scale-0 bg-[var(--accent)] transition-transform group-has-[:checked]:scale-100",
                          question.type === "MULTIPLE_CHOICE" ? "rounded-[2px]" : "rounded-full"
                        )}
                      />
                    </span>
                    <input
                      type={question.type === "MULTIPLE_CHOICE" ? "checkbox" : "radio"}
                      name={`q_${question.id}`}
                      value={option.id}
                      checked={respuestas[question.id].opciones.includes(option.id)}
                      onChange={(e) => {
                        const previas = respuestas[question.id].opciones;
                        const opciones =
                          question.type === "MULTIPLE_CHOICE"
                            ? e.target.checked
                              ? [...previas, option.id]
                              : previas.filter((id) => id !== option.id)
                            : [option.id];
                        actualizar(question.id, { opciones });
                      }}
                      className="sr-only"
                    />
                    <span className="min-w-0 break-words text-[14px] text-foreground">{option.text}</span>
                  </label>
                ))}
              </div>
            )}
            {/* Pie de la pregunta: cuánto vale y si ya quedó guardada. */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-muted-foreground">
              <span>
                {question.type === "OPEN_TEXT"
                  ? "Respuesta abierta · la revisa Talento Humano"
                  : question.type === "MULTIPLE_CHOICE"
                    ? `Selección múltiple · ${question.score} puntos`
                    : question.type === "TRUE_FALSE"
                      ? `Verdadero o falso · ${question.score} puntos`
                      : `Selección única · ${question.score} puntos`}
              </span>
              {estaRespondida(question) && guardado !== "guardando" && <RespuestaGuardada />}
            </div>
          </div>
        </article>
      ))}

      {state.error && (
        <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{state.error}</p>
      )}

      {/*
        Cierre de la evaluación, al final del listado y sin barra flotante.
        La barra fija tapaba una franja de la última pregunta y acompañaba
        todo el rato sin hacer falta: navegar ya se hace con el stepper de
        arriba, así que aquí solo queda enviar.

        El estado del guardado sí se conserva -en pequeño, junto al botón-:
        quitarlo dejaría al estudiante sin saber si su borrador llegó al
        servidor, que es justo lo que evita perder el trabajo.
      */}
      <div className="surface-glass flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {respondidas} de {questions.length} respondidas
          </p>
          <span className="mt-0.5 flex items-center gap-1.5 text-[11.5px]">
            {guardado === "guardando" && (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                <span className="text-muted-foreground">Guardando…</span>
              </>
            )}
            {guardado === "guardado" && (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                <span className="text-muted-foreground">Tus respuestas están guardadas</span>
              </>
            )}
            {guardado === "error" && (
              <>
                <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                <span className="text-destructive">No se guardó</span>
                <button type="button" onClick={reintentarGuardado} className="underline underline-offset-2">
                  Reintentar
                </button>
              </>
            )}
            {guardado === "inactivo" && (
              <span className="text-muted-foreground">Se guarda solo mientras respondes.</span>
            )}
          </span>
        </div>

        <Button type="button" onClick={() => setConfirmando(true)} disabled={pending} className="gap-2 px-6">
          {pending ? "Enviando…" : "Enviar evaluación"}
          <Send className="h-4 w-4" />
        </Button>
      </div>

      </div>

      {/* Columna derecha: pegajosa, para que el resumen siga a la vista
          mientras se baja por las preguntas. */}
      <aside className="xl:sticky xl:top-4">
        <PanelEvaluacion
          respondidas={respondidas}
          total={questions.length}
          marcadas={marcadas.length}
          area={area}
          tutor={tutor}
          fechaLimite={fechaLimite}
          passingScore={passingScore}
        />
      </aside>
      </div>

      {/* Deshabilitar el envío sin decir por qué es una pared. En su lugar el
          botón siempre abre esta confirmación, que enumera lo que falta. */}
      <Dialog open={confirmando} onOpenChange={setConfirmando}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Enviar la evaluación?</DialogTitle>
            <DialogDescription>
              {sinResponder.length === 0
                ? "Respondiste todas las preguntas. Después de enviar no podrás cambiarlas."
                : "Te faltan " + sinResponder.length + " de " + questions.length + " preguntas por responder."}
            </DialogDescription>
          </DialogHeader>

          {sinResponder.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sin responder</p>
              <ul className="flex flex-wrap gap-1.5">
                {sinResponder.map((q) => (
                  <li key={q.id}>
                    <button
                      type="button"
                      className="paso"
                      data-estado="pendiente"
                      onClick={() => {
                        setConfirmando(false);
                        irA(questions.indexOf(q));
                      }}
                    >
                      {questions.indexOf(q) + 1}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {marcadas.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Marcadas para revisar
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {marcadas.map((q) => (
                  <li key={q.id}>
                    <button
                      type="button"
                      className="paso"
                      data-estado="marcada"
                      onClick={() => {
                        setConfirmando(false);
                        irA(questions.indexOf(q));
                      }}
                    >
                      {questions.indexOf(q) + 1}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmando(false)}>
              Seguir respondiendo
            </Button>
            {/* form="form-evaluacion": el diálogo se renderiza en un portal,
                fuera del <form>, así que sin este atributo el botón de tipo
                submit no envía nada. */}
            <Button
              type="submit"
              form="form-evaluacion"
              disabled={pending}
              onClick={() => {
                vaciarPendientes();
                setConfirmando(false);
              }}
              className="gap-2"
            >
              Enviar ahora
              <Send className="h-4 w-4" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}
