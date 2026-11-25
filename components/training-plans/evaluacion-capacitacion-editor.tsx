"use client";

import { FileText, ListChecks, Pencil, Plus, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuizFormDialog } from "@/components/cursos/quiz-form-dialog";
import { DeleteConfirmButton } from "@/components/cursos/delete-confirm-button";
import { LessonFormDialog } from "@/components/cursos/lesson-form-dialog";
import { ConstructorPreguntas } from "@/components/cursos/constructor-preguntas";
import { LESSON_CONTENT_TYPE_LABELS } from "@/components/cursos/labels";
import { updateQuizAction } from "@/app/admin/cursos/quiz-actions";
import { createLessonAction, updateLessonAction, deleteLessonAction } from "@/app/admin/cursos/lesson-actions";
import { analizarExcelEvaluacionAction, guardarPreguntaAction, importarExcelEvaluacionAction } from "@/app/admin/planes-capacitacion/evaluacion-acciones";
import type { EvaluacionCapacitacion } from "@/lib/evaluacion-capacitacion";
import type { LessonContentType } from "@prisma/client";

/**
 * EVALUACIÓN PRESABER / POSTSABER, armada dentro de la capacitación.
 *
 * Las preguntas se arman con el constructor común
 * (components/cursos/constructor-preguntas.tsx): escribiéndolas aquí o
 * cargándolas desde Excel. No hay paso de «crear la evaluación»: nace con la
 * primera pregunta. Es la MISMA evaluación en los dos momentos (antes y
 * después de la capacitación). Debajo, el video y el material.
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
  const quiz = evaluacion?.quiz ?? null;
  const preguntas = quiz?.questions ?? [];

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

        <ConstructorPreguntas
          quizId={quiz?.id ?? null}
          preguntas={preguntas}
          bloqueada={bloqueada}
          acciones={{
            guardar: guardarPreguntaAction.bind(null, basePath, activityId),
            analizar: analizarExcelEvaluacionAction.bind(null, activityId),
            importar: importarExcelEvaluacionAction.bind(null, basePath, activityId),
          }}
        />
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
