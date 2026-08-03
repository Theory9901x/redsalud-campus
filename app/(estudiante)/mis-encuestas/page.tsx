import Link from "next/link";
import { ClipboardCheck, CheckCircle2, ArrowRight, ShieldQuestion, Sparkles, TrendingUp } from "lucide-react";
import { auth } from "@/auth";
import { getSurveysForUser } from "@/lib/surveys";
import {
  getEvaluacionesCicloDisponibles,
  getHistorialEvaluaciones,
  getPromedioEvaluaciones,
} from "@/lib/training-plans";
import { StaggerSections } from "@/components/brand/stagger-sections";
import { EmptyState } from "@/components/brand/empty-state";
import { MetricCard } from "@/components/admin/metric-card";
import { MisEncuestasBoard } from "@/components/training-plans/mis-encuestas-board";
import { Badge } from "@/components/ui/badge";

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

  return (
    <main className="accent-student mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
      <StaggerSections className="space-y-6">
        {/* Hero */}
        <section className="hud-hero hud-grid noise-overlay relative overflow-hidden px-6 py-10 sm:px-10 sm:py-12">
          <div className="pointer-events-none absolute -left-16 top-1/4 h-64 w-64 rounded-full bg-[var(--accent)]/25 blur-[90px]" />
          <div className="relative grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-8">
              <span className="chip-glass">
                <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" />
                Bienvenido
              </span>
              <h1 className="mt-4 max-w-2xl font-display text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl">
                {firstName ? `${firstName}, ` : ""}Mis encuestas y{" "}
                <span
                  className="bg-clip-text text-transparent"
                  style={{ backgroundImage: "linear-gradient(90deg, var(--accent), var(--success))" }}
                >
                  evaluaciones
                </span>
              </h1>
              <p className="mt-3 max-w-lg text-sm text-white/70">
                Gestiona aquí tus presaberes, postsaberes y encuestas de opinión. Tu aprendizaje importa.
              </p>
            </div>

            <div className="flex items-center gap-5 lg:col-span-4 lg:justify-end">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-white/10 backdrop-blur">
                <ClipboardCheck className="h-9 w-9 text-white/80" aria-hidden="true" />
              </div>
              <div className="border-l border-white/15 pl-5">
                <p className="font-display text-3xl font-extrabold leading-none text-white">{disponiblesAhora}</p>
                <p className="mt-1 text-xs text-white/60">Disponibles ahora</p>
              </div>
            </div>
          </div>
        </section>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetricCard label="Disponibles ahora" value={disponiblesAhora} icon={ClipboardCheck} accent="primary" />
          <MetricCard label="Pendientes" value={pending.length} icon={ShieldQuestion} accent="warning" />
          <MetricCard label="Completadas" value={completadas} icon={CheckCircle2} accent="success" />
          <MetricCard
            label="Promedio obtenido"
            value={promedio ?? 0}
            suffix={promedio !== null ? "%" : ""}
            icon={TrendingUp}
            accent="primary"
          />
        </div>

        {/* Tablero: presaber / postsaber / encuestas abiertas ahora */}
        <MisEncuestasBoard evaluaciones={evaluaciones} encuestas={pending} />

        {/* Historial reciente */}
        <section className="surface-panel p-6 sm:p-8">
          <div className="pointer-events-none absolute -bottom-20 -left-16 h-64 w-64 rounded-full bg-success/[0.07] blur-3xl" />
          <div className="relative space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-extrabold text-foreground">Historial reciente</h2>
                <p className="text-xs text-muted-foreground">Tus últimas evaluaciones y encuestas completadas.</p>
              </div>
              {answered.length > 0 && (
                <Link href="#respondidas" className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                  Ver todas <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </div>

            {historial.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="Aún no tienes historial" description="Lo que presentes o respondas quedará aquí como constancia." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="pb-2 pr-3 font-semibold">Evaluación</th>
                      <th className="pb-2 pr-3 font-semibold">Tipo</th>
                      <th className="pb-2 pr-3 font-semibold">Fecha</th>
                      <th className="pb-2 pr-3 font-semibold">Resultado</th>
                      <th className="pb-2 font-semibold">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historial.map((h, i) => (
                      <tr key={i} className="border-b border-border/60 last:border-0">
                        <td className="py-2.5 pr-3 font-medium text-foreground">{h.titulo}</td>
                        <td className="py-2.5 pr-3">
                          <Badge className={TIPO_CLASSES[h.tipo]}>{TIPO_LABEL[h.tipo]}</Badge>
                        </td>
                        <td className="py-2.5 pr-3 text-muted-foreground">{FORMATO_FECHA.format(h.fecha)}</td>
                        <td className="py-2.5 pr-3 font-semibold text-foreground">{h.resultado !== null ? `${h.resultado}%` : "—"}</td>
                        <td className="py-2.5">
                          {h.tipo === "ENCUESTA" ? (
                            <span className="text-xs font-medium text-success">Completada</span>
                          ) : (
                            <span className={`text-xs font-medium ${h.aprobado ? "text-success" : "text-destructive"}`}>
                              {h.aprobado ? "Aprobado" : "No aprobado"}
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
