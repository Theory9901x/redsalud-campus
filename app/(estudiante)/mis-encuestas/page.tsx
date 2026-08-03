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
    {
      label: "Disponibles ahora",
      sub: "Evaluaciones abiertas para presentar",
      value: disponiblesAhora,
      suffix: "",
      icon: ClipboardCheck,
      accent: "primary" as const,
    },
    {
      label: "Pendientes",
      sub: "Encuestas por responder",
      value: pending.length,
      suffix: "",
      icon: ShieldQuestion,
      accent: "accent" as const,
    },
    {
      label: "Completadas",
      sub: "Evaluaciones y encuestas finalizadas",
      value: completadas,
      suffix: "",
      icon: CheckCircle2,
      accent: "success" as const,
    },
    {
      label: "Promedio obtenido",
      sub: promedio !== null ? "Sobre tus evaluaciones con nota" : "Aún sin evaluaciones con nota",
      value: promedio ?? 0,
      suffix: promedio !== null ? "%" : "",
      icon: TrendingUp,
      accent: "warning" as const,
    },
  ];
  const KPI_STYLES = {
    primary: { icon: "bg-primary/15 text-primary", glow: "bg-primary/20" },
    accent: { icon: "bg-[var(--accent)]/15 text-[var(--accent)]", glow: "bg-[var(--accent)]/20" },
    success: { icon: "bg-success/15 text-success", glow: "bg-success/20" },
    warning: { icon: "bg-warning/15 text-warning-foreground", glow: "bg-warning/20" },
  } as const;

  return (
    <main className="accent-student aula-canvas min-h-full">
      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-8 sm:py-12">
        <StaggerSections className="space-y-8">
          {/* Hero */}
          <section className="surface-glass surface-accent-top relative overflow-hidden px-8 py-10 sm:px-12 sm:py-14">
            <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-primary/[0.14] blur-[100px]" />
            <div className="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-success/[0.1] blur-[100px]" />
            <div className="relative flex flex-col items-start gap-8 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide text-primary">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  Bienvenido
                </span>
                <h1 className="mt-4 font-display text-3xl font-extrabold leading-[1.1] tracking-tight text-foreground sm:text-4xl">
                  {firstName ? `${firstName}, ` : ""}Mis encuestas y{" "}
                  <span
                    className="bg-clip-text text-transparent"
                    style={{ backgroundImage: "linear-gradient(90deg, var(--primary), var(--success))" }}
                  >
                    evaluaciones
                  </span>
                </h1>
                <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
                  Gestiona aquí tus presaberes, postsaberes y encuestas de opinión. Tu aprendizaje importa.
                </p>
              </div>

              {/* Ilustración: composición de vidrio en capas, con los mismos tokens del sistema -sin assets externos. */}
              <div className="relative hidden h-40 w-40 shrink-0 items-center justify-center sm:flex">
                <div className="absolute h-36 w-36 rotate-6 rounded-[2rem] bg-gradient-to-br from-primary/30 to-success/20 blur-[2px]" />
                <div className="surface-glass absolute flex h-32 w-32 -rotate-3 items-center justify-center rounded-[1.75rem]">
                  <ClipboardCheck className="h-14 w-14 text-primary drop-shadow-sm" aria-hidden="true" strokeWidth={1.75} />
                </div>
                <span className="absolute -right-2 -top-2 flex h-9 w-9 items-center justify-center rounded-full bg-success text-success-foreground shadow-lg">
                  <Sparkle className="h-4 w-4" aria-hidden="true" />
                </span>
                <Sparkles className="absolute -bottom-2 -left-2 h-6 w-6 text-primary/60" aria-hidden="true" />
              </div>
            </div>
          </section>

          {/* KPIs */}
          <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
            {KPIS.map((k) => {
              const s = KPI_STYLES[k.accent];
              return (
                <div key={k.label} className="surface-glass surface-accent-top relative overflow-hidden p-6">
                  <div className={cn("pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full blur-2xl", s.glow)} />
                  <div className="relative flex flex-col gap-4">
                    <span className={cn("flex h-12 w-12 items-center justify-center rounded-2xl", s.icon)}>
                      <k.icon className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
                    </span>
                    <div>
                      <p className="font-display text-[32px] font-extrabold leading-none tracking-tight text-foreground">
                        {k.value}
                        {k.suffix}
                      </p>
                      <p className="mt-2 text-sm font-bold text-foreground">{k.label}</p>
                      <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{k.sub}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tablero: presaber / postsaber / encuestas abiertas ahora */}
          <MisEncuestasBoard evaluaciones={evaluaciones} encuestas={pending} />

          {/* Pendientes + Historial, uno junto al otro */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <section className="surface-glass relative overflow-hidden p-6 sm:p-8">
              <div className="pointer-events-none absolute -bottom-16 -right-16 h-56 w-56 rounded-full bg-warning/[0.1] blur-3xl" />
              <div className="relative space-y-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning/15 text-warning-foreground">
                    <ShieldQuestion className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="font-display text-lg font-extrabold text-foreground">Pendientes</h2>
                    <p className="text-xs text-muted-foreground">Encuestas que requieren tu atención.</p>
                  </div>
                </div>

                {pending.length === 0 ? (
                  <EmptyState
                    icon={ShieldQuestion}
                    title="Sin pendientes"
                    description="Cuando tengas una encuesta asignada, aparecerá aquí."
                    className="py-8"
                  />
                ) : (
                  <div className="space-y-3">
                    {pending.slice(0, 4).map((survey) => (
                      <div key={survey.id} className="surface-clay flex items-center gap-4 p-4">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-success/15 text-success">
                          <ClipboardList className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <Badge className="mb-1.5 bg-success/15 text-success">Encuesta</Badge>
                          <p className="truncate font-display text-sm font-bold text-foreground">{survey.title}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {survey.trainingActivity?.area?.name ?? survey.trainingPlan.title}
                            {survey.trainingActivity?.area?.tutor && ` · Tutor: ${survey.trainingActivity.area.tutor.fullName}`}
                          </p>
                        </div>
                        <Link
                          href={`/mis-encuestas/${survey.id}`}
                          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-transform hover:-translate-y-0.5"
                        >
                          Responder <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="surface-glass relative overflow-hidden p-6 sm:p-8">
              <div className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-success/[0.1] blur-3xl" />
              <div className="relative space-y-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div>
                      <h2 className="font-display text-lg font-extrabold text-foreground">Historial reciente</h2>
                      <p className="text-xs text-muted-foreground">Tus últimas evaluaciones completadas.</p>
                    </div>
                  </div>
                  {answered.length > 0 && (
                    <Link href="#respondidas" className="flex shrink-0 items-center gap-1 text-xs font-semibold text-primary hover:underline">
                      Ver todo <ArrowRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>

                {historial.length === 0 ? (
                  <EmptyState
                    icon={CheckCircle2}
                    title="Aún no tienes historial"
                    description="Lo que presentes o respondas quedará aquí como constancia."
                    className="py-8"
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                          <th className="pb-3 pr-3 font-semibold">Evaluación</th>
                          <th className="pb-3 pr-3 font-semibold">Tipo</th>
                          <th className="pb-3 pr-3 font-semibold">Fecha</th>
                          <th className="pb-3 font-semibold">Resultado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historial.slice(0, 5).map((h, i) => (
                          <tr key={i} className="border-b border-border/60 last:border-0">
                            <td className="max-w-[180px] truncate py-3 pr-3 font-medium text-foreground">{h.titulo}</td>
                            <td className="py-3 pr-3">
                              <Badge className={TIPO_CLASSES[h.tipo]}>{TIPO_LABEL[h.tipo]}</Badge>
                            </td>
                            <td className="py-3 pr-3 text-muted-foreground">{FORMATO_FECHA.format(h.fecha)}</td>
                            <td className="py-3">
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
          <section id="respondidas" className="surface-glass relative overflow-hidden p-6 sm:p-8">
            <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/[0.08] blur-3xl" />
            <div className="relative space-y-5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success/15 text-success">
                  <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                </span>
                <h2 className="font-display text-lg font-extrabold text-foreground">Encuestas respondidas</h2>
              </div>
              {answered.length === 0 ? (
                <EmptyState icon={CheckCircle2} title="Aún no respondes ninguna" description="Las que respondas quedarán aquí como constancia." />
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {answered.map((survey) => (
                    <div key={survey.id} className="surface-clay flex items-center gap-4 p-4 opacity-80">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-success/15 text-success">
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
      </div>
    </main>
  );
}
