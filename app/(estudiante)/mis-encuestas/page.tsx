import Link from "next/link";
import {
  ClipboardCheck,
  CheckCircle2,
  ArrowRight,
  ShieldQuestion,
  Sparkles,
  TrendingUp,
  Sparkle,
  ClipboardList,
} from "lucide-react";
import { auth } from "@/auth";
import { getSurveysForUser } from "@/lib/surveys";
import {
  getEvaluacionesCicloDisponibles,
  getHistorialEvaluaciones,
  getPromedioEvaluaciones,
} from "@/lib/training-plans";
import { StaggerSections } from "@/components/brand/stagger-sections";
import { EmptyState } from "@/components/brand/empty-state";
import { MisEncuestasBoard } from "@/components/training-plans/mis-encuestas-board";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const FORMATO_FECHA = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric" });

const TIPO_LABEL: Record<"PRESABER" | "POSTSABER" | "ENCUESTA", string> = {
  PRESABER: "Presaber",
  POSTSABER: "Postsaber",
  ENCUESTA: "Encuesta",
};
const TIPO_CLASSES: Record<"PRESABER" | "POSTSABER" | "ENCUESTA", string> = {
  PRESABER: "bg-warning/15 text-warning-foreground",
  POSTSABER: "bg-primary/10 text-primary",
  ENCUESTA: "bg-success/15 text-success",
};

export default async function MisEncuestasPage() {
  const session = await auth();
  const userId = session!.user.id;
  const firstName = session!.user.name?.split(" ")[0];

  const [{ pending, answered }, evaluaciones, historial, promedio] = await Promise.all([
    getSurveysForUser(userId),
    getEvaluacionesCicloDisponibles(userId, session!.user.personnelType ?? null),
    getHistorialEvaluaciones(userId),
    getPromedioEvaluaciones(userId),
  ]);

  const disponiblesAhora = evaluaciones.length + pending.length;
  const completadas = answered.length + historial.filter((h) => h.tipo !== "ENCUESTA").length;

  const KPIS = [
    { label: "Disponibles ahora", sub: "Evaluaciones abiertas para presentar", value: disponiblesAhora, suffix: "", icon: ClipboardCheck, accent: "primary" as const },
    { label: "Pendientes", sub: "Encuestas por responder", value: pending.length, suffix: "", icon: ShieldQuestion, accent: "accent" as const },
    { label: "Completadas", sub: "Evaluaciones y encuestas finalizadas", value: completadas, suffix: "", icon: CheckCircle2, accent: "success" as const },
    { label: "Promedio obtenido", sub: promedio !== null ? "Sobre tus evaluaciones con nota" : "Aún sin evaluaciones con nota", value: promedio ?? 0, suffix: promedio !== null ? "%" : "", icon: TrendingUp, accent: "warning" as const },
  ];
  const KPI_STYLES = {
    primary: "bg-primary/10 text-primary",
    accent: "bg-[var(--accent)]/15 text-[var(--accent)]",
    success: "bg-success/15 text-success",
    warning: "bg-warning/15 text-warning-foreground",
  } as const;

  return (
    <main className="accent-student mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
      <StaggerSections className="space-y-6">
        {/* Hero + KPIs, en una sola fila como el tablero de referencia */}
        <div className="flex flex-col gap-4 xl:flex-row">
          <section className="surface-panel relative flex-[1.6] overflow-hidden px-6 py-8 sm:px-8">
            <div className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 rounded-full bg-primary/[0.08] blur-3xl" />
            <div className="relative flex items-center gap-6">
              <div className="min-w-0 flex-1">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-primary">
                  Bienvenido
                </span>
                <h1 className="mt-3 font-display text-2xl font-extrabold leading-tight text-foreground sm:text-3xl">
                  {firstName ? `${firstName}, ` : ""}Mis encuestas y evaluaciones
                </h1>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                  Gestiona aquí tus presaberes, postsaberes y encuestas de opinión. Tu aprendizaje importa.
                </p>
              </div>

              {/* Ilustración decorativa: composición de vidrio con los mismos tokens, sin assets externos. */}
              <div className="relative hidden h-32 w-32 shrink-0 items-center justify-center sm:flex">
                <div className="absolute h-28 w-28 rotate-6 rounded-3xl bg-gradient-to-br from-primary/25 to-success/20" />
                <div className="surface-glass absolute flex h-24 w-24 -rotate-3 items-center justify-center">
                  <ClipboardList className="h-10 w-10 text-primary" aria-hidden="true" />
                </div>
                <Sparkle className="absolute -right-1 -top-1 h-6 w-6 text-success" aria-hidden="true" />
                <Sparkles className="absolute -bottom-1 -left-1 h-5 w-5 text-primary/70" aria-hidden="true" />
              </div>
            </div>
          </section>

          <div className="grid flex-[2] grid-cols-2 gap-4 xl:grid-cols-4">
            {KPIS.map((k) => (
              <div key={k.label} className="surface-clay flex flex-col justify-between gap-3 p-4">
                <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg", KPI_STYLES[k.accent])}>
                  <k.icon className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
                </span>
                <div>
                  <p className="font-display text-2xl font-extrabold leading-none text-foreground">
                    {k.value}
                    {k.suffix}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-foreground/80">{k.label}</p>
                  <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{k.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tablero: presaber / postsaber / encuestas abiertas ahora */}
        <MisEncuestasBoard evaluaciones={evaluaciones} encuestas={pending} />

        {/* Pendientes + Historial, uno junto al otro */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <section className="surface-panel p-6 sm:p-8">
            <div className="pointer-events-none absolute -bottom-16 -right-16 h-56 w-56 rounded-full bg-warning/[0.06] blur-3xl" />
            <div className="relative space-y-4">
              <div className="flex items-center gap-3">
                <span className="h-8 w-1.5 shrink-0 rounded-full bg-gradient-to-b from-warning to-primary" />
                <div>
                  <h2 className="font-display text-lg font-extrabold text-foreground">Pendientes</h2>
                  <p className="text-xs text-muted-foreground">Encuestas que requieren tu atención.</p>
                </div>
              </div>

              {pending.length === 0 ? (
                <EmptyState icon={ShieldQuestion} title="Sin pendientes" description="Cuando tengas una encuesta asignada, aparecerá aquí." className="py-8" />
              ) : (
                <div className="space-y-2.5">
                  {pending.slice(0, 4).map((survey) => (
                    <div key={survey.id} className="surface-clay flex items-center gap-3 p-4">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success/15 text-success">
                        <ClipboardList className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <Badge className="mb-1 bg-success/15 text-success">Encuesta</Badge>
                        <p className="truncate font-display text-sm font-bold text-foreground">{survey.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {survey.trainingActivity?.area?.name ?? survey.trainingPlan.title}
                          {survey.trainingActivity?.area?.tutor && ` · Tutor: ${survey.trainingActivity.area.tutor.fullName}`}
                        </p>
                      </div>
                      <Link
                        href={`/mis-encuestas/${survey.id}`}
                        className="flex shrink-0 items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground"
                      >
                        Responder <ArrowRight className="h-3 w-3" aria-hidden="true" />
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="surface-panel p-6 sm:p-8">
            <div className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-success/[0.06] blur-3xl" />
            <div className="relative space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-extrabold text-foreground">Historial reciente</h2>
                  <p className="text-xs text-muted-foreground">Tus últimas evaluaciones completadas.</p>
                </div>
                {answered.length > 0 && (
                  <Link href="#respondidas" className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                    Ver todo <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </div>

              {historial.length === 0 ? (
                <EmptyState icon={CheckCircle2} title="Aún no tienes historial" description="Lo que presentes o respondas quedará aquí como constancia." className="py-8" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                        <th className="pb-2 pr-3 font-semibold">Evaluación</th>
                        <th className="pb-2 pr-3 font-semibold">Tipo</th>
                        <th className="pb-2 pr-3 font-semibold">Fecha</th>
                        <th className="pb-2 font-semibold">Resultado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historial.slice(0, 5).map((h, i) => (
                        <tr key={i} className="border-b border-border/60 last:border-0">
                          <td className="max-w-[180px] truncate py-2.5 pr-3 font-medium text-foreground">{h.titulo}</td>
                          <td className="py-2.5 pr-3">
                            <Badge className={TIPO_CLASSES[h.tipo]}>{TIPO_LABEL[h.tipo]}</Badge>
                          </td>
                          <td className="py-2.5 pr-3 text-muted-foreground">{FORMATO_FECHA.format(h.fecha)}</td>
                          <td className="py-2.5">
                            {h.tipo === "ENCUESTA" ? (
                              <span className="text-xs font-medium text-success">Completada</span>
                            ) : (
                              <span className={`text-xs font-semibold ${h.aprobado ? "text-success" : "text-destructive"}`}>
                                {h.resultado}% · {h.aprobado ? "Aprobado" : "No aprobado"}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Respondidas: constancia completa */}
        <section id="respondidas" className="surface-panel p-6 sm:p-8">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/[0.07] blur-3xl" />
          <div className="relative space-y-4">
            <div className="flex items-center gap-3">
              <span className="h-8 w-1.5 shrink-0 rounded-full bg-gradient-to-b from-primary to-success" />
              <h2 className="font-display text-lg font-extrabold text-foreground">Encuestas respondidas</h2>
            </div>
            {answered.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="Aún no respondes ninguna" description="Las que respondas quedarán aquí como constancia." />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {answered.map((survey) => (
                  <div key={survey.id} className="surface-clay flex items-center gap-4 p-4 opacity-80">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success/15 text-success">
                      <CheckCircle2 className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-sm font-bold text-foreground">{survey.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
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
