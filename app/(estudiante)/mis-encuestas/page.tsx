import Link from "next/link";
import { ClipboardList, CheckCircle2, FileQuestion, ClipboardCheck, ArrowRight } from "lucide-react";
import { auth } from "@/auth";
import { getSurveysForUser } from "@/lib/surveys";
import { getEvaluacionesCicloDisponibles } from "@/lib/training-plans";
import { MOMENTO_LABEL } from "@/lib/presaber-postsaber";
import { EmptyState } from "@/components/brand/empty-state";
import { StaggerSections } from "@/components/brand/stagger-sections";

export default async function MisEncuestasPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [{ pending, answered }, evaluaciones] = await Promise.all([
    getSurveysForUser(userId),
    getEvaluacionesCicloDisponibles(userId, session!.user.personnelType ?? null),
  ]);

  // Agrupadas por el área que genera cada capacitación: es el eje del plan.
  const porArea = new Map<string, typeof evaluaciones>();
  for (const ev of evaluaciones) {
    const lista = porArea.get(ev.area) ?? [];
    lista.push(ev);
    porArea.set(ev.area, lista);
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
      <StaggerSections className="space-y-10">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-foreground">Mis encuestas y evaluaciones</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Los presaber y postsaber que están abiertos ahora mismo, y las encuestas de opinión de tus capacitaciones.
          </p>
        </div>

        {evaluaciones.length > 0 && (
          <section className="surface-panel p-6 sm:p-8">
            <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-warning/[0.07] blur-3xl" />
            <div className="relative space-y-5">
              <div className="flex items-center gap-3">
                <span className="h-8 w-1.5 shrink-0 rounded-full bg-gradient-to-b from-warning to-primary" />
                <div>
                  <h2 className="font-display text-2xl font-extrabold text-foreground">Evaluaciones disponibles</h2>
                  <p className="text-xs text-muted-foreground">
                    Presaber y postsaber con ventana abierta: entra directo y preséntala.
                  </p>
                </div>
              </div>
              {[...porArea.entries()].map(([area, lista]) => (
                <div key={area} className="space-y-2.5">
                  <h3 className="font-display text-xs font-bold uppercase tracking-wide text-muted-foreground">{area}</h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {lista.map((ev) => (
                      <Link
                        key={`${ev.activityId}-${ev.momento}`}
                        href={`/c/${ev.activityId}/${ev.momento === "PRESABER" ? "presaber" : "postsaber"}`}
                        className="surface-clay flex items-center gap-4 p-5 transition-all duration-200 hover:-translate-y-0.5"
                      >
                        <span
                          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                            ev.momento === "PRESABER" ? "bg-warning/15 text-warning" : "bg-primary/10 text-primary"
                          }`}
                        >
                          {ev.momento === "PRESABER" ? <FileQuestion className="h-6 w-6" /> : <ClipboardCheck className="h-6 w-6" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                                ev.momento === "PRESABER" ? "bg-warning/15 text-warning" : "bg-primary/10 text-primary"
                              }`}
                            >
                              {MOMENTO_LABEL[ev.momento]}
                            </span>
                            {ev.yaPresentado && (
                              <span className="flex items-center gap-1 text-[11px] font-medium text-success">
                                <CheckCircle2 className="h-3 w-3" /> Ya presentado
                              </span>
                            )}
                          </div>
                          <p className="mt-1 truncate font-display text-sm font-bold text-foreground">{ev.titulo}</p>
                        </div>
                        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="surface-panel p-6 sm:p-8">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/[0.07] blur-3xl" />
          <div className="relative space-y-4">
            <div className="flex items-center gap-3">
              <span className="h-8 w-1.5 shrink-0 rounded-full bg-gradient-to-b from-primary to-success" />
              <h2 className="font-display text-2xl font-extrabold text-foreground">Pendientes</h2>
            </div>
            {pending.length === 0 ? (
              <EmptyState icon={ClipboardList} title="Sin encuestas pendientes" description="Cuando tengas una asignada, aparecerá aquí." />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {pending.map((survey) => (
                  <Link
                    key={survey.id}
                    href={`/mis-encuestas/${survey.id}`}
                    className="surface-clay flex items-center gap-4 p-5 transition-all duration-200 hover:-translate-y-0.5"
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <ClipboardList className="h-6 w-6" />
                    </span>
                    <div className="flex-1">
                      <p className="font-display text-sm font-bold text-foreground">{survey.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {survey.trainingActivity ? survey.trainingActivity.title : survey.trainingPlan.title} ·{" "}
                        {survey._count.questions} {survey._count.questions === 1 ? "pregunta" : "preguntas"}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="surface-panel p-6 sm:p-8">
          <div className="pointer-events-none absolute -bottom-20 -left-16 h-64 w-64 rounded-full bg-success/[0.07] blur-3xl" />
          <div className="relative space-y-4">
            <div className="flex items-center gap-3">
              <span className="h-8 w-1.5 shrink-0 rounded-full bg-gradient-to-b from-primary to-success" />
              <h2 className="font-display text-2xl font-extrabold text-foreground">Respondidas</h2>
            </div>
            {answered.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="Aún no respondes ninguna" description="Las que respondas quedarán aquí como constancia." />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {answered.map((survey) => (
                  <div key={survey.id} className="surface-clay flex items-center gap-4 p-5 opacity-80">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-success/15 text-success">
                      <CheckCircle2 className="h-6 w-6" />
                    </span>
                    <div className="flex-1">
                      <p className="font-display text-sm font-bold text-foreground">{survey.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {survey.trainingActivity ? survey.trainingActivity.title : survey.trainingPlan.title}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </StaggerSections>
    </main>
  );
}
