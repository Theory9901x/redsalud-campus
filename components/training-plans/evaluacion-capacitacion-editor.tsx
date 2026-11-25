"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  ImageIcon,
  ListChecks,
  Loader2,
  Pencil,
  PencilLine,
  Plus,
  Settings2,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { QuizFormDialog } from "@/components/cursos/quiz-form-dialog";
import { QuestionFormDialog } from "@/components/cursos/question-form-dialog";
import { DeleteConfirmButton } from "@/components/cursos/delete-confirm-button";
import { LessonFormDialog } from "@/components/cursos/lesson-form-dialog";
import { createLessonAction, updateLessonAction, deleteLessonAction } from "@/app/admin/cursos/lesson-actions";
import { LESSON_CONTENT_TYPE_LABELS } from "@/components/cursos/labels";
import { updateQuizAction, updateQuestionAction, deleteQuestionAction, reorderQuestionsAction } from "@/app/admin/cursos/quiz-actions";
import {
  analizarExcelEvaluacionAction,
  guardarPreguntaAction,
  importarExcelEvaluacionAction,
  type DatosPregunta,
} from "@/app/admin/planes-capacitacion/evaluacion-acciones";
import type { EvaluacionCapacitacion } from "@/lib/evaluacion-capacitacion";
import type { ErrorImportacion, PreguntaImportada } from "@/lib/evaluacion-excel";
import type { LessonContentType } from "@prisma/client";

type Tipo = DatosPregunta["type"];
type Pregunta = NonNullable<EvaluacionCapacitacion["quiz"]>["questions"][number];

const TIPOS: { tipo: Tipo; nombre: string; ayuda: string }[] = [
  { tipo: "SINGLE_CHOICE", nombre: "Única respuesta", ayuda: "Varias opciones, una sola correcta." },
  { tipo: "MULTIPLE_CHOICE", nombre: "Varias respuestas", ayuda: "Varias opciones, dos o más correctas." },
  { tipo: "TRUE_FALSE", nombre: "Verdadero o falso", ayuda: "La persona elige verdadero o falso." },
  { tipo: "OPEN_TEXT", nombre: "Abierta", ayuda: "La persona escribe su respuesta; no suma puntaje automático." },
];
const NOMBRE_TIPO = Object.fromEntries(TIPOS.map((t) => [t.tipo, t.nombre])) as Record<Tipo, string>;
const LETRAS = ["A", "B", "C", "D", "E", "F"];
const VF = [
  { text: "Verdadero", isCorrect: true },
  { text: "Falso", isCorrect: false },
];
const NUEVA: DatosPregunta = {
  type: "SINGLE_CHOICE",
  statement: "",
  score: 1,
  explanation: "",
  expectedAnswer: "",
  options: [
    { text: "", isCorrect: false },
    { text: "", isCorrect: false },
    { text: "", isCorrect: false },
    { text: "", isCorrect: false },
  ],
};

const campo = "w-full rounded-lg border border-border bg-background px-3 py-2 text-[14px] text-foreground outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-primary/60";

/**
 * EVALUACIÓN PRESABER / POSTSABER, armada dentro de la capacitación.
 *
 * Dos formas de crearla, siempre a la vista:
 *   · ESCRIBIRLA AQUÍ: las preguntas se escriben y se corrigen en la misma
 *     página, sin ventanas emergentes.
 *   · CARGARLA DESDE EXCEL: se descarga la plantilla, se llena y se sube; antes
 *     de guardar se muestra qué se va a cargar y qué fila tiene un problema.
 *
 * No hay paso de «crear la evaluación»: nace con la primera pregunta. Es la
 * MISMA evaluación en los dos momentos (antes y después de la capacitación).
 */
export function EvaluacionCapacitacionEditor({
  evaluacion,
  activityId,
  basePath,
  bloqueada = false,
}: {
  evaluacion: EvaluacionCapacitacion | null;
  activityId: string;
  basePath: string;
  /** Plan cerrado: solo consulta. */
  bloqueada?: boolean;
}) {
  const router = useRouter();
  const quiz = evaluacion?.quiz ?? null;
  const preguntas = quiz?.questions ?? [];
  const [modo, setModo] = useState<"constructor" | "excel">("constructor");
  /** Qué pregunta está abierta en el formulario: su id, "nueva" o ninguna. */
  const [editando, setEditando] = useState<string | null>(null);
  const [moviendo, iniciarMover] = useTransition();

  const mover = (indice: number, salto: -1 | 1) => {
    if (!quiz) return;
    const ids = preguntas.map((p) => p.id);
    const destino = indice + salto;
    if (destino < 0 || destino >= ids.length) return;
    [ids[indice], ids[destino]] = [ids[destino], ids[indice]];
    iniciarMover(async () => {
      try {
        await reorderQuestionsAction(quiz.id, ids);
        router.refresh();
      } catch {
        toast.error("No se pudo cambiar el orden.");
      }
    });
  };

  return (
    <div className="space-y-5">
      <section className="barra-modulo space-y-5 p-5" aria-label="Evaluación presaber / postsaber">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
              <ListChecks className="h-5 w-5 text-primary" aria-hidden="true" />
              {preguntas.length === 0 ? "Arma la evaluación" : `${preguntas.length} ${preguntas.length === 1 ? "pregunta" : "preguntas"}`}
            </h3>
            <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">
              {quiz ? (
                <>
                  Se aprueba con <b className="text-foreground">{quiz.passingScore}%</b> · {quiz.maxAttempts} {quiz.maxAttempts === 1 ? "intento" : "intentos"} por momento
                  {quiz.timeLimitMinutes ? ` · ${quiz.timeLimitMinutes} min` : ""}. La misma evaluación se presenta antes (presaber) y después (postsaber).
                </>
              ) : (
                "Escribe las preguntas aquí o cárgalas desde Excel. La misma evaluación se presenta antes de la capacitación (presaber) y después (postsaber), para medir lo aprendido."
              )}
            </p>
          </div>
          {quiz && !bloqueada && (
            <QuizFormDialog
              mode="edit"
              action={updateQuizAction.bind(null, quiz.id)}
              moduleId={null}
              contextLabel="Ajustes de la evaluación presaber / postsaber de esta capacitación. Los intentos cuentan por momento."
              defaultValues={{
                title: quiz.title,
                description: quiz.description ?? "",
                passingScore: quiz.passingScore,
                maxAttempts: quiz.maxAttempts,
                timeLimitMinutes: quiz.timeLimitMinutes,
                randomizeQuestions: quiz.randomizeQuestions,
                randomizeAnswers: quiz.randomizeAnswers,
                showResultsNow: quiz.showResultsNow,
              }}
              trigger={
                <Button type="button" variant="outline" size="sm" className="gap-1.5">
                  <Settings2 className="h-4 w-4" aria-hidden="true" />
                  Nota mínima e intentos
                </Button>
              }
            />
          )}
        </div>

        {!bloqueada && (
          <div className="grid gap-2 sm:grid-cols-2" role="tablist" aria-label="Cómo crear la evaluación">
            {(
              [
                { valor: "constructor", Icono: PencilLine, titulo: "Escribir las preguntas aquí", bajada: "Una por una, en esta misma página." },
                { valor: "excel", Icono: FileSpreadsheet, titulo: "Cargar desde Excel", bajada: "Descarga la plantilla, llénala y súbela." },
              ] as const
            ).map(({ valor, Icono, titulo, bajada }) => (
              <button
                key={valor}
                type="button"
                role="tab"
                aria-selected={modo === valor}
                onClick={() => setModo(valor)}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-3.5 text-left transition-colors",
                  modo === valor ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/50",
                )}
              >
                <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", modo === valor ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                  <Icono className="h-5 w-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-[14.5px] font-bold text-foreground">{titulo}</span>
                  <span className="block text-[13px] text-muted-foreground">{bajada}</span>
                </span>
              </button>
            ))}
          </div>
        )}

        {modo === "excel" && !bloqueada ? (
          <CargaExcel activityId={activityId} basePath={basePath} hayPreguntas={preguntas.length > 0} alTerminar={() => setModo("constructor")} />
        ) : (
          <>
            {preguntas.length === 0 && editando !== "nueva" && (
              <p className="rounded-xl border border-dashed border-border bg-card/60 p-5 text-center text-[14px] text-muted-foreground">
                Aún no hay preguntas. {bloqueada ? "" : "Agrega la primera con el botón de abajo."}
              </p>
            )}

            {preguntas.length > 0 && (
              <ol className="space-y-2.5">
                {preguntas.map((q, i) =>
                  editando === q.id ? (
                    <li key={q.id}>
                      <FormularioPregunta
                        titulo={`Pregunta ${i + 1}`}
                        inicial={{ type: q.type, statement: q.statement, score: q.score, explanation: q.explanation ?? "", expectedAnswer: q.expectedAnswer ?? "", options: q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })) }}
                        guardar={(datos) => guardarPreguntaAction(basePath, activityId, q.id, datos)}
                        alCerrar={() => setEditando(null)}
                      />
                    </li>
                  ) : (
                    <FilaPregunta
                      key={q.id}
                      q={q}
                      numero={i + 1}
                      total={preguntas.length}
                      bloqueada={bloqueada}
                      ocupado={moviendo}
                      alEditar={() => setEditando(q.id)}
                      alMover={(salto) => mover(i, salto)}
                    />
                  ),
                )}
              </ol>
            )}

            {!bloqueada &&
              (editando === "nueva" ? (
                <FormularioPregunta
                  key={preguntas.length}
                  titulo={`Pregunta ${preguntas.length + 1}`}
                  inicial={NUEVA}
                  guardar={(datos) => guardarPreguntaAction(basePath, activityId, null, datos)}
                  alCerrar={() => setEditando(null)}
                  permiteOtra
                />
              ) : (
                <Button type="button" onClick={() => setEditando("nueva")} className="h-11 gap-2 px-5 text-[14.5px]">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Agregar pregunta
                </Button>
              ))}
          </>
        )}
      </section>

      {evaluacion && (evaluacion.material.length > 0 || evaluacion.moduloMaterialId) && (
        <section className="barra-modulo space-y-4 p-5" aria-label="Video y material de la capacitación">
          <div>
            <h3 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
              <FileText className="h-5 w-5 text-primary" aria-hidden="true" />
              Video y material
            </h3>
            <p className="mt-1 text-[13.5px] text-muted-foreground">
              Lo que la persona ve dentro de la capacitación: el video, las diapositivas y las lecturas.{bloqueada ? " Solo consulta." : " Se edita aquí mismo."}
            </p>
          </div>
          <ul className="space-y-2.5">
            {evaluacion.material.map((m) => (
              <li key={m.id} className="rounded-[14px] border border-border/80 bg-card p-4">
                <p className="text-[14.5px] font-semibold text-foreground">{m.titulo}</p>
                <p className="mt-0.5 text-[13px] text-muted-foreground">
                  {LESSON_CONTENT_TYPE_LABELS[m.tipo as LessonContentType] ?? m.tipo}
                  {m.estimatedMinutes ? ` · ${m.estimatedMinutes} min` : ""}
                  {m.isRequired ? " · obligatorio" : ""}
                </p>
                {m.tipo === "VIDEO" && m.fileUrl && (
                  <div className="mt-3 overflow-hidden rounded-xl bg-black">
                    <video controls preload="metadata" playsInline src={m.fileUrl} className="aspect-video w-full" />
                  </div>
                )}
                {!bloqueada && (
                  <div className="mt-2.5 space-x-1.5">
                    {m.fileUrl && (
                      <a href={m.fileUrl} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-[13px] font-semibold text-foreground hover:border-primary/60">
                        Ver archivo
                      </a>
                    )}
                    <DeleteConfirmButton title="¿Quitar este material?" description="Sale de la capacitación junto con el avance que las personas tengan en él." onConfirm={() => deleteLessonAction(m.id)} />
                    <LessonFormDialog
                      mode="edit"
                      action={updateLessonAction.bind(null, m.id)}
                      defaultValues={{
                        title: m.titulo,
                        description: m.descripcion ?? "",
                        contentType: m.tipo as LessonContentType,
                        contentBody: m.contentBody ?? "",
                        videoUrl: m.videoUrl ?? "",
                        externalUrl: m.externalUrl ?? "",
                        isRequired: m.isRequired,
                        estimatedMinutes: m.estimatedMinutes,
                        fileUrl: m.fileUrl,
                      }}
                      trigger={
                        <Button type="button" variant="outline" size="sm" className="gap-1.5">
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                          Editar
                        </Button>
                      }
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
          {!bloqueada && evaluacion.moduloMaterialId && (
            <div>
              <LessonFormDialog
                mode="create"
                action={createLessonAction.bind(null, evaluacion.moduloMaterialId)}
                defaultValues={{ contentType: "VIDEO" }}
                trigger={
                  <Button type="button" variant="outline" className="h-10 gap-2">
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Agregar video o material
                  </Button>
                }
              />
            </div>
          )}
        </section>
      )}
    </div>
  );
}

/** Una pregunta ya guardada: enunciado, opciones con la correcta marcada y sus acciones. */
function FilaPregunta({
  q,
  numero,
  total,
  bloqueada,
  ocupado,
  alEditar,
  alMover,
}: {
  q: Pregunta;
  numero: number;
  total: number;
  bloqueada: boolean;
  ocupado: boolean;
  alEditar: () => void;
  alMover: (salto: -1 | 1) => void;
}) {
  return (
    <li className="rounded-[14px] border border-border/80 bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[14px] font-bold text-primary">{numero}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[14.5px] font-semibold leading-snug text-foreground">{q.statement}</p>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            {NOMBRE_TIPO[q.type]} · {q.score} {q.score === 1 ? "punto" : "puntos"}
            {q.imageUrl ? " · con imagen" : ""}
          </p>
          {q.options.length > 0 && (
            <ul className="mt-2.5 grid gap-1.5 sm:grid-cols-2">
              {q.options.map((o, i) => (
                <li
                  key={o.id}
                  className={cn(
                    "flex items-start gap-2 rounded-lg border px-2.5 py-1.5 text-[13.5px]",
                    o.isCorrect ? "border-success/40 bg-success/10 font-semibold text-foreground" : "border-border/70 text-muted-foreground",
                  )}
                >
                  <span className="font-bold">{LETRAS[i] ?? i + 1}.</span>
                  <span className="min-w-0 flex-1">{o.text}</span>
                  {o.isCorrect && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-label="Correcta" />}
                </li>
              ))}
            </ul>
          )}
          {q.type === "OPEN_TEXT" && q.expectedAnswer && <p className="mt-2 text-[13px] text-muted-foreground">Respuesta esperada: {q.expectedAnswer}</p>}
        </div>
        {!bloqueada && (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-0.5">
            <Button type="button" variant="ghost" size="icon-sm" disabled={ocupado || numero === 1} onClick={() => alMover(-1)} aria-label={`Subir la pregunta ${numero}`}>
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" disabled={ocupado || numero === total} onClick={() => alMover(1)} aria-label={`Bajar la pregunta ${numero}`}>
              <ArrowDown className="h-4 w-4" />
            </Button>
            <QuestionFormDialog
              mode="edit"
              action={updateQuestionAction.bind(null, q.id)}
              defaultValues={{ type: q.type, statement: q.statement, imageUrl: q.imageUrl, expectedAnswer: q.expectedAnswer, score: q.score, explanation: q.explanation ?? "", options: q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })) }}
              trigger={
                <Button type="button" variant="ghost" size="icon-sm" aria-label={`Poner o cambiar la imagen de la pregunta ${numero}`} title="Imagen de apoyo">
                  <ImageIcon className="h-4 w-4" />
                </Button>
              }
            />
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={alEditar}>
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              Editar
            </Button>
            <DeleteConfirmButton
              title="¿Eliminar esta pregunta?"
              description="Sale de la evaluación junto con las respuestas que ya le hayan dado."
              onConfirm={() => deleteQuestionAction(q.id)}
            />
          </div>
        )}
      </div>
    </li>
  );
}

/** Formulario en línea de una pregunta (nueva o existente). */
function FormularioPregunta({
  titulo,
  inicial,
  guardar,
  alCerrar,
  permiteOtra = false,
}: {
  titulo: string;
  inicial: DatosPregunta;
  guardar: (datos: DatosPregunta) => Promise<{ error: string | null }>;
  alCerrar: () => void;
  permiteOtra?: boolean;
}) {
  const router = useRouter();
  const [d, setD] = useState<DatosPregunta>(inicial);
  const [mas, setMas] = useState(inicial.score !== 1 || !!inicial.explanation);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const conOpciones = d.type === "SINGLE_CHOICE" || d.type === "MULTIPLE_CHOICE";

  const cambiarTipo = (type: Tipo) => {
    setError(null);
    setD((a) => {
      if (type === "TRUE_FALSE") return { ...a, type, options: VF.map((o) => ({ ...o })) };
      if (type === "OPEN_TEXT") return { ...a, type, options: [] };
      // De V/F o abierta a opciones: se parte de cuatro casillas vacías.
      const base = a.type === "SINGLE_CHOICE" || a.type === "MULTIPLE_CHOICE" ? a.options : NUEVA.options.map((o) => ({ ...o }));
      // Única respuesta admite una sola correcta: se conserva la primera marcada.
      const primera = base.findIndex((o) => o.isCorrect);
      return { ...a, type, options: type === "SINGLE_CHOICE" ? base.map((o, i) => ({ ...o, isCorrect: i === primera })) : base };
    });
  };

  const marcar = (indice: number) =>
    setD((a) => ({
      ...a,
      options: a.options.map((o, i) => (a.type === "MULTIPLE_CHOICE" ? (i === indice ? { ...o, isCorrect: !o.isCorrect } : o) : { ...o, isCorrect: i === indice })),
    }));

  const enviar = (otra: boolean) => {
    setError(null);
    iniciar(async () => {
      const r = await guardar(d);
      if (r.error) return setError(r.error);
      toast.success("Pregunta guardada.");
      router.refresh();
      if (otra) setD({ ...NUEVA, type: d.type === "OPEN_TEXT" ? "SINGLE_CHOICE" : d.type, options: d.type === "TRUE_FALSE" ? VF.map((o) => ({ ...o })) : NUEVA.options.map((o) => ({ ...o })) });
      else alCerrar();
    });
  };

  return (
    <div className="space-y-4 rounded-[14px] border-2 border-primary/50 bg-card p-4 sm:p-5">
      <p className="text-[15px] font-bold text-foreground">{titulo}</p>

      <div>
        <p className="mb-1.5 text-[13.5px] font-semibold text-foreground">Tipo de pregunta</p>
        <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-4">
          {TIPOS.map((t) => (
            <button
              key={t.tipo}
              type="button"
              aria-pressed={d.type === t.tipo}
              title={t.ayuda}
              onClick={() => cambiarTipo(t.tipo)}
              className={cn(
                "rounded-lg border px-3 py-2 text-[13.5px] font-semibold transition-colors",
                d.type === t.tipo ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground hover:border-primary/50",
              )}
            >
              {t.nombre}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[13px] text-muted-foreground">{TIPOS.find((t) => t.tipo === d.type)?.ayuda}</p>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-[13.5px] font-semibold text-foreground">Pregunta</span>
        <textarea autoFocus rows={2} value={d.statement} onChange={(e) => setD({ ...d, statement: e.target.value })} placeholder="Escribe la pregunta tal como la leerá la persona." className={campo} />
      </label>

      {d.type !== "OPEN_TEXT" && (
        <fieldset>
          <legend className="mb-1.5 text-[13.5px] font-semibold text-foreground">
            {d.type === "TRUE_FALSE" ? "¿Cuál es la respuesta correcta?" : d.type === "MULTIPLE_CHOICE" ? "Opciones (marca todas las correctas)" : "Opciones (marca la correcta)"}
          </legend>
          <div className="space-y-2">
            {d.options.map((o, i) => (
              <div key={i} className={cn("flex items-center gap-2 rounded-lg border p-1.5 pl-2.5", o.isCorrect ? "border-success/50 bg-success/10" : "border-border")}>
                <label className="flex shrink-0 cursor-pointer items-center gap-2 text-[13px] font-semibold text-muted-foreground" title="Marcar como correcta">
                  <input
                    type={d.type === "MULTIPLE_CHOICE" ? "checkbox" : "radio"}
                    name="correcta"
                    checked={o.isCorrect}
                    onChange={() => marcar(i)}
                    className="h-[18px] w-[18px] accent-[var(--success)]"
                    aria-label={`La opción ${LETRAS[i]} es correcta`}
                  />
                  {LETRAS[i]}
                </label>
                {conOpciones ? (
                  <input
                    value={o.text}
                    onChange={(e) => setD({ ...d, options: d.options.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)) })}
                    placeholder={`Opción ${LETRAS[i]}`}
                    aria-label={`Texto de la opción ${LETRAS[i]}`}
                    className="h-9 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 text-[14px] outline-none focus-visible:border-primary/60 focus-visible:bg-background"
                  />
                ) : (
                  <span className="flex-1 px-2 text-[14px] text-foreground">{o.text}</span>
                )}
                {o.isCorrect && <span className="hidden shrink-0 pr-1 text-[12.5px] font-semibold text-success sm:inline">Correcta</span>}
                {conOpciones && d.options.length > 2 && (
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => setD({ ...d, options: d.options.filter((_, k) => k !== i) })} aria-label={`Quitar la opción ${LETRAS[i]}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
          {conOpciones && d.options.length < LETRAS.length && (
            <Button type="button" variant="ghost" size="sm" className="mt-2 gap-1.5" onClick={() => setD({ ...d, options: [...d.options, { text: "", isCorrect: false }] })}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Agregar opción
            </Button>
          )}
          {conOpciones && <p className="mt-1 text-[13px] text-muted-foreground">Las casillas que dejes vacías no se guardan.</p>}
        </fieldset>
      )}

      {d.type === "OPEN_TEXT" && (
        <label className="block">
          <span className="mb-1.5 block text-[13.5px] font-semibold text-foreground">
            Respuesta esperada <span className="font-normal text-muted-foreground">(opcional; la persona la ve al revisar)</span>
          </span>
          <textarea rows={2} value={d.expectedAnswer} onChange={(e) => setD({ ...d, expectedAnswer: e.target.value })} className={campo} />
        </label>
      )}

      <div>
        <button type="button" onClick={() => setMas(!mas)} aria-expanded={mas} className="inline-flex items-center gap-1 text-[13.5px] font-semibold text-primary">
          <ChevronDown className={cn("h-4 w-4 transition-transform", mas && "rotate-180")} aria-hidden="true" />
          Puntos y retroalimentación
        </button>
        {mas && (
          <div className="mt-2.5 grid gap-3 sm:grid-cols-[8rem_minmax(0,1fr)]">
            <label className="block">
              <span className="mb-1.5 block text-[13.5px] font-semibold text-foreground">Puntos</span>
              <input type="number" min={1} max={100} value={d.score} onChange={(e) => setD({ ...d, score: Math.max(1, Math.min(100, Math.round(Number(e.target.value) || 1))) })} className={campo} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[13.5px] font-semibold text-foreground">
                Retroalimentación <span className="font-normal text-muted-foreground">(opcional)</span>
              </span>
              <input value={d.explanation} onChange={(e) => setD({ ...d, explanation: e.target.value })} placeholder="Explicación que la persona ve después de responder." className={campo} />
            </label>
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-[13.5px] font-medium text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => enviar(false)} disabled={pendiente} className="h-10 gap-2 px-5">
          {pendiente ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
          Guardar pregunta
        </Button>
        {permiteOtra && (
          <Button type="button" variant="outline" onClick={() => enviar(true)} disabled={pendiente} className="h-10 gap-2">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Guardar y agregar otra
          </Button>
        )}
        <Button type="button" variant="ghost" onClick={alCerrar} disabled={pendiente} className="h-10">
          Cancelar
        </Button>
      </div>
    </div>
  );
}

/** Cargar la evaluación desde la plantilla de Excel: descargar, llenar, subir y confirmar. */
function CargaExcel({ activityId, basePath, hayPreguntas, alTerminar }: { activityId: string; basePath: string; hayPreguntas: boolean; alTerminar: () => void }) {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [analisis, setAnalisis] = useState<{ preguntas: PreguntaImportada[]; errores: ErrorImportacion[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reemplazar, setReemplazar] = useState(false);
  const [pendiente, iniciar] = useTransition();

  const cuerpo = (f: File) => {
    const fd = new FormData();
    fd.set("archivo", f);
    fd.set("modo", reemplazar ? "reemplazar" : "agregar");
    return fd;
  };

  const elegir = (f: File | undefined | null) => {
    if (!f) return;
    setArchivo(f);
    setAnalisis(null);
    setError(null);
    iniciar(async () => {
      const r = await analizarExcelEvaluacionAction(activityId, cuerpo(f));
      if (r.error) setError(r.error);
      else setAnalisis({ preguntas: r.preguntas, errores: r.errores });
    });
  };

  const cargar = () => {
    if (!archivo) return;
    setError(null);
    iniciar(async () => {
      const r = await importarExcelEvaluacionAction(basePath, activityId, cuerpo(archivo));
      if (r.error) return setError(r.error);
      toast.success(`${r.agregadas} ${r.agregadas === 1 ? "pregunta cargada" : "preguntas cargadas"}.`);
      router.refresh();
      alTerminar();
    });
  };

  const reiniciar = () => {
    setArchivo(null);
    setAnalisis(null);
    setError(null);
    if (entrada.current) entrada.current.value = "";
  };

  return (
    <div className="space-y-4">
      <ol className="grid gap-3 md:grid-cols-3">
        <li className="rounded-xl border border-border bg-card p-4">
          <p className="text-[14.5px] font-bold text-foreground">1. Descarga la plantilla</p>
          <p className="mt-1 text-[13.5px] text-muted-foreground">Trae las columnas listas, ejemplos y una hoja de instrucciones.</p>
          <a href="/api/planes-capacitacion/evaluacion/plantilla" className="mt-3 inline-flex h-10 items-center gap-2 rounded-lg border border-primary/50 bg-primary/10 px-4 text-[14px] font-semibold text-primary hover:bg-primary/15">
            <Download className="h-4 w-4" aria-hidden="true" />
            Descargar plantilla
          </a>
        </li>
        <li className="rounded-xl border border-border bg-card p-4">
          <p className="text-[14.5px] font-bold text-foreground">2. Llénala en Excel</p>
          <p className="mt-1 text-[13.5px] text-muted-foreground">Una pregunta por fila: el texto, las opciones y la letra de la respuesta correcta. Guárdala como .xlsx.</p>
        </li>
        <li className="rounded-xl border border-border bg-card p-4">
          <p className="text-[14.5px] font-bold text-foreground">3. Súbela aquí</p>
          <p className="mt-1 text-[13.5px] text-muted-foreground">Antes de guardar verás qué preguntas se van a cargar.</p>
          <input ref={entrada} type="file" accept=".xlsx" className="hidden" onChange={(e) => elegir(e.target.files?.[0])} />
          <Button type="button" onClick={() => entrada.current?.click()} disabled={pendiente} className="mt-3 h-10 gap-2">
            {pendiente && !analisis ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
            {archivo ? "Elegir otro archivo" : "Elegir archivo"}
          </Button>
        </li>
      </ol>

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-[13.5px] font-medium text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      {analisis && archivo && (
        <div className="space-y-4 rounded-xl border-2 border-primary/50 bg-card p-4 sm:p-5">
          <div>
            <p className="text-[15px] font-bold text-foreground">
              {analisis.preguntas.length === 0 ? "No hay preguntas para cargar" : `${analisis.preguntas.length} ${analisis.preguntas.length === 1 ? "pregunta lista" : "preguntas listas"} para cargar`}
            </p>
            <p className="text-[13px] text-muted-foreground">{archivo.name}</p>
          </div>

          {analisis.errores.length > 0 && (
            <div className="rounded-lg border border-warning/50 bg-warning/15 p-3">
              <p className="flex items-center gap-2 text-[14px] font-bold text-foreground">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                {analisis.errores.length === 1 ? "Una fila tiene un problema y no se cargará" : `${analisis.errores.length} filas tienen problemas y no se cargarán`}
              </p>
              <ul className="mt-2 space-y-1 text-[13.5px] text-foreground">
                {analisis.errores.slice(0, 30).map((e, i) => (
                  <li key={i}>
                    {e.fila > 0 && <b>Fila {e.fila}: </b>}
                    {e.mensaje}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[13px] text-muted-foreground">Puedes corregir el archivo y volver a subirlo, o cargar solo las que están bien.</p>
            </div>
          )}

          {analisis.preguntas.length > 0 && (
            <>
              <ol className="max-h-[22rem] space-y-2 overflow-y-auto pr-1">
                {analisis.preguntas.map((p, i) => (
                  <li key={p.fila} className="rounded-lg border border-border/80 p-3">
                    <p className="text-[14px] font-semibold text-foreground">
                      {i + 1}. {p.statement}
                    </p>
                    <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                      {NOMBRE_TIPO[p.type]} · {p.score} {p.score === 1 ? "punto" : "puntos"} · fila {p.fila}
                    </p>
                    {p.options.length > 0 && (
                      <ul className="mt-1.5 flex flex-wrap gap-1.5">
                        {p.options.map((o, k) => (
                          <li key={k} className={cn("rounded-md border px-2 py-0.5 text-[13px]", o.isCorrect ? "border-success/40 bg-success/10 font-semibold text-foreground" : "border-border/70 text-muted-foreground")}>
                            {LETRAS[k]}. {o.text}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ol>

              {hayPreguntas && (
                <fieldset className="space-y-1.5">
                  <legend className="mb-1 text-[13.5px] font-semibold text-foreground">La evaluación ya tiene preguntas</legend>
                  <label className="flex items-center gap-2 text-[14px]">
                    <input type="radio" name="modo-carga" checked={!reemplazar} onChange={() => setReemplazar(false)} className="h-4 w-4" />
                    Agregar estas a las que ya están
                  </label>
                  <label className="flex items-center gap-2 text-[14px]">
                    <input type="radio" name="modo-carga" checked={reemplazar} onChange={() => setReemplazar(true)} className="h-4 w-4" />
                    Reemplazar las actuales por estas
                  </label>
                </fieldset>
              )}

              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={cargar} disabled={pendiente} className="h-10 gap-2 px-5">
                  {pendiente ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
                  Cargar {analisis.preguntas.length} {analisis.preguntas.length === 1 ? "pregunta" : "preguntas"}
                </Button>
                <Button type="button" variant="ghost" onClick={reiniciar} disabled={pendiente} className="h-10">
                  Cancelar
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
