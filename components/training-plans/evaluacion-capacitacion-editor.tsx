"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { CheckCircle2, ClipboardCheck, FileText, ListChecks, Pencil, Plus, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuizFormDialog } from "@/components/cursos/quiz-form-dialog";
import { QuestionFormDialog } from "@/components/cursos/question-form-dialog";
import { DeleteConfirmButton } from "@/components/cursos/delete-confirm-button";
import { QUESTION_TYPE_LABELS, LESSON_CONTENT_TYPE_LABELS } from "@/components/cursos/labels";
import { updateQuizAction, createQuestionAction, updateQuestionAction, deleteQuestionAction } from "@/app/admin/cursos/quiz-actions";
import type { EvaluacionCapacitacion } from "@/lib/evaluacion-capacitacion";
import type { LessonContentType } from "@prisma/client";

/**
 * EVALUACIÓN PRESABER / POSTSABER, armada dentro de la capacitación.
 *
 * El área escribe aquí sus preguntas (con opciones y la correcta), el mínimo
 * para aprobar y los intentos. Es la MISMA evaluación en los dos momentos:
 * antes de la capacitación (presaber) y después (postsaber). Los editores de
 * pregunta y de ajustes son los mismos del resto de la plataforma.
 */
export function EvaluacionCapacitacionEditor({
  evaluacion,
  onCrear,
  bloqueada = false,
}: {
  evaluacion: EvaluacionCapacitacion | null;
  onCrear: () => Promise<{ error: string | null }>;
  /** Plan cerrado o capacitación cerrada: solo consulta. */
  bloqueada?: boolean;
}) {
  const [pendiente, iniciar] = useTransition();
  const quiz = evaluacion?.quiz ?? null;

  function crear() {
    iniciar(async () => {
      const r = await onCrear();
      if (r.error) toast.error(r.error);
      else toast.success("Evaluación creada. Agrega la primera pregunta.");
    });
  }

  return (
    <div className="space-y-5">
      {!quiz ? (
        <div className="barra-modulo flex flex-col items-start gap-3 p-6">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ClipboardCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h3 className="font-display text-base font-bold text-foreground">Esta capacitación aún no tiene evaluación</h3>
            <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
              Arma aquí la evaluación presaber / postsaber: las preguntas con sus opciones y la respuesta correcta, el mínimo
              para aprobar y los intentos. La misma evaluación se presenta antes y después de la capacitación para medir lo
              aprendido.
            </p>
          </div>
          {!bloqueada && (
            <Button type="button" onClick={crear} disabled={pendiente} className="gap-1.5">
              <Plus className="h-4 w-4" aria-hidden="true" />
              {pendiente ? "Creando…" : "Crear evaluación"}
            </Button>
          )}
        </div>
      ) : (
        <section className="barra-modulo space-y-4 p-5" aria-label="Evaluación presaber / postsaber">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="flex items-center gap-2 font-display text-base font-bold text-foreground">
                <ListChecks className="h-4 w-4 text-primary" aria-hidden="true" />
                {quiz.title}
              </h3>
              <p className="mt-1 text-[12.5px] text-muted-foreground">
                {quiz.questions.length} {quiz.questions.length === 1 ? "pregunta" : "preguntas"} · mínimo para aprobar{" "}
                <b className="text-foreground">{quiz.passingScore}%</b> · {quiz.maxAttempts}{" "}
                {quiz.maxAttempts === 1 ? "intento" : "intentos"} por momento
                {quiz.timeLimitMinutes ? ` · ${quiz.timeLimitMinutes} min` : ""}
              </p>
            </div>
            {!bloqueada && (
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
                    <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Mínimo e intentos
                  </Button>
                }
              />
            )}
          </div>

          {quiz.questions.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border bg-card/60 p-4 text-center text-[13px] text-muted-foreground">
              Sin preguntas todavía. Agrega la primera: sin preguntas no hay presaber ni postsaber que presentar.
            </p>
          ) : (
            <ol className="space-y-2">
              {quiz.questions.map((q, i) => {
                const correctas = q.options.filter((o) => o.isCorrect).map((o) => o.text);
                return (
                  <li key={q.id} className="rounded-[14px] border border-border/80 bg-card p-3.5">
                    <div className="flex flex-wrap items-start gap-2">
                      <span className="mt-0.5 font-mono text-[11px] font-bold text-muted-foreground">P{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13.5px] font-semibold leading-snug text-foreground">{q.statement}</p>
                        <p className="mt-1 text-[11.5px] text-muted-foreground">
                          {QUESTION_TYPE_LABELS[q.type]} · {q.score} {q.score === 1 ? "punto" : "puntos"}
                          {q.options.length > 0 && ` · ${q.options.length} opciones`}
                        </p>
                        {correctas.length > 0 && (
                          <p className="mt-1.5 flex items-start gap-1.5 text-[12px] text-success">
                            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span>{correctas.join(" · ")}</span>
                          </p>
                        )}
                      </div>
                      {!bloqueada && (
                        <div className="flex items-center gap-1">
                          <QuestionFormDialog
                            mode="edit"
                            action={updateQuestionAction.bind(null, q.id)}
                            defaultValues={{
                              type: q.type,
                              statement: q.statement,
                              imageUrl: q.imageUrl,
                              expectedAnswer: q.expectedAnswer,
                              score: q.score,
                              explanation: q.explanation ?? "",
                              options: q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })),
                            }}
                            trigger={
                              <Button type="button" variant="ghost" size="icon-sm" aria-label={`Editar pregunta ${i + 1}`}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                            }
                          />
                          <DeleteConfirmButton
                            title="¿Eliminar esta pregunta?"
                            description="Sale de la evaluación. Las respuestas ya presentadas se conservan en los intentos registrados."
                            onConfirm={() => deleteQuestionAction(q.id)}
                          />
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          {!bloqueada && (
            <QuestionFormDialog
              mode="create"
              action={createQuestionAction.bind(null, quiz.id)}
              trigger={
                <Button type="button" variant="outline" size="sm" className="gap-1.5">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Agregar pregunta
                </Button>
              }
            />
          )}
        </section>
      )}

      {evaluacion && evaluacion.material.length > 0 && (
        <section className="barra-modulo space-y-3 p-5" aria-label="Material de la capacitación">
          <div>
            <h3 className="flex items-center gap-2 font-display text-base font-bold text-foreground">
              <FileText className="h-4 w-4 text-primary" aria-hidden="true" />
              Material de la capacitación
            </h3>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              Presentaciones y lecturas que ya tenía esta capacitación. Solo consulta.
            </p>
          </div>
          <ul className="divide-y divide-border/60 rounded-[14px] border border-border/80 bg-card">
            {evaluacion.material.map((m, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                <span className="text-[13px] font-medium text-foreground">{m.titulo}</span>
                <span className="text-[11.5px] text-muted-foreground">
                  {LESSON_CONTENT_TYPE_LABELS[m.tipo as LessonContentType] ?? m.tipo} · {m.modulo}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
