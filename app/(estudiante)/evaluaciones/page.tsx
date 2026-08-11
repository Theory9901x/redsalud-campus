import Link from "next/link";
import {
  ClipboardCheck,
  CircleCheck,
  ArrowRight,
  ShieldQuestion,
  TrendingUp,
  ClipboardList,
  History,
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
import { EvaluacionesBoard } from "@/components/training-plans/evaluaciones-board";
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

/**
 * "Evaluaciones de capacitación": presaber, postsaber y encuestas de opinión
 * del estudiante, en un solo lugar y en el orden en que le sirven — primero
 * lo que puede presentar AHORA, después su historial.
 *
 * Mismo lenguaje visual que "Mis capacitaciones": lienzo de formación,
 * encabezado de producto, indicadores en vidrio y secciones separadas, para
 * que no se vea todo revuelto. Toda cifra es real; el promedio llega null
 * mientras no haya evaluaciones con nota y entonces se omite.
 */
export default async function EvaluacionesPage() {
  const session = await auth();
  const userId = session!.user.id;
  const primerNombre = session!.user.name?.split(" ")[0];

  const [{ pending, answered }, evaluaciones, historial, promedio] = await Promise.all([
    getSurveysForUser(userId),
    getEvaluacionesCicloDisponibles(userId, session!.user.personnelType ?? null),
    getHistorialEvaluaciones(userId),
    getPromedioEvaluaciones(userId),
  ]);

  const disponiblesAhora = evaluaciones.length + pending.length;
  const presentadas = historial.filter((h) => h.tipo !== "ENCUESTA").length;

  const KPIS = [
    {
      valor: String(disponiblesAhora),
      etiqueta: "Disponibles ahora",
      icon: ClipboardCheck,
      chip: "bg-primary/12 text-primary",
      destacar: disponiblesAhora > 0,
    },
    {
      valor: String(pending.length),
      etiqueta: "Encuestas por responder",
      icon: ShieldQuestion,
      chip: "bg-warning/18 text-warning-foreground",
    },
    {
      valor: String(presentadas + answered.length),
      etiqueta: "Completadas",
      icon: CircleCheck,
      chip: "bg-success/15 text-success",
    },
    ...(promedio !== null
      ? [
          {
            valor: `${promedio}%`,
            etiqueta: "Promedio obtenido",
            icon: TrendingUp,
            chip: "bg-primary/12 text-primary",
          },
        ]
      : [
          {
            valor: String(historial.length),
            etiqueta: "En tu historial",
            icon: History,
            chip: "bg-primary/12 text-primary",
          },
        ]),
  ];

  return (
    <main className="canvas-formacion min-h-full flex-1">
      <div className="mx-auto w-full max-w-[1480px] px-4 py-8 sm:px-6 lg:px-8">
        <StaggerSections className="space-y-8">
          {/* Encabezado del módulo */}
          <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Formación institucional</p>
              <h1 className="mt-2 font-display text-[clamp(1.9rem,4vw,2.35rem)] font-extrabold leading-[1.1] tracking-tight text-foreground">
                Evaluaciones de capacitación
              </h1>
              <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
                {primerNombre ? `${primerNombre}, presenta` : "Presenta"} tus evaluaciones de presaber y postsaber,
                responde las encuestas de tus capacitaciones y consulta tus resultados.
              </p>
            </div>

            {disponiblesAhora > 0 && (
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-warning/35 bg-warning/12 px-4 py-2 text-sm font-semibold text-warning-foreground">
                <span className="h-2 w-2 animate-pulse rounded-full bg-warning" aria-hidden="true" />
                {disponiblesAhora} {disponiblesAhora === 1 ? "pendiente por presentar" : "pendientes por presentar"}
              </span>
            )}
          </header>

          {/* Indicadores */}
          <section aria-label="Resumen de tus evaluaciones">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {KPIS.map((k) => (
                <div key={k.etiqueta} className="surface-lumen flex items-center gap-4 p-5">
                  <span className={cn("relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", k.chip)}>
                    <k.icon className="h-5 w-5" strokeWidth={1.7} aria-hidden="true" />
                    {"destacar" in k && k.destacar && (
                      <span
                        className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-warning"
                        aria-hidden="true"
                      />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="font-display text-2xl font-extrabold leading-none tracking-tight text-foreground">
                      {k.valor}
                    </p>
                    <p className="mt-1 text-[13px] leading-tight text-muted-foreground">{k.etiqueta}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Lo que se puede presentar ahora */}
          <EvaluacionesBoard evaluaciones={evaluaciones} encuestas={pending} />

          {/* Historial */}
          <section aria-label="Historial de evaluaciones" className="space-y-5">
            <div>
              <h2 className="font-display text-xl font-bold tracking-tight text-foreground sm:text-[21px]">
                Historial
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Tus evaluaciones y encuestas ya presentadas, con su resultado.
              </p>
            </div>

            {historial.length === 0 ? (
              <div className="surface-lumen p-8">
                <EmptyState
                  icon={History}
                  title="Aún no tienes historial"
                  description="Lo que presentes o respondas quedará aquí como constancia, con su fecha y resultado."
                />
              </div>
            ) : (
              <div className="surface-lumen overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-border/60 text-[11px] uppercase tracking-wide text-muted-foreground">
                        <th scope="col" className="px-6 py-4 font-semibold">Evaluación</th>
                        <th scope="col" className="px-3 py-4 font-semibold">Tipo</th>
                        <th scope="col" className="px-3 py-4 font-semibold">Fecha</th>
                        <th scope="col" className="px-6 py-4 font-semibold">Resultado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historial.map((h, i) => (
                        <tr key={i} className="border-b border-border/40 last:border-0 transition-colors hover:bg-foreground/[0.02]">
                          <td className="max-w-[280px] truncate px-6 py-4 font-medium text-foreground">{h.titulo}</td>
                          <td className="px-3 py-4">
                            <Badge className={TIPO_CLASSES[h.tipo]}>{TIPO_LABEL[h.tipo]}</Badge>
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-muted-foreground">
                            {FORMATO_FECHA.format(h.fecha)}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4">
                            {h.tipo === "ENCUESTA" ? (
                              <span className="text-xs font-semibold text-success">Respondida</span>
                            ) : (
                              <span className="flex items-center gap-2">
                                <span className="font-display text-base font-bold text-foreground">{h.resultado}%</span>
                                <span
                                  className={cn(
                                    "text-xs font-semibold",
                                    h.aprobado ? "text-success" : "text-destructive"
                                  )}
                                >
                                  {h.aprobado ? "Aprobado" : "No aprobado"}
                                </span>
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

          {/* Encuestas ya respondidas: constancia, no acción */}
          {answered.length > 0 && (
            <section aria-label="Encuestas respondidas" className="space-y-5">
              <div>
                <h2 className="font-display text-xl font-bold tracking-tight text-foreground sm:text-[21px]">
                  Encuestas respondidas
                </h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Quedan como constancia de tu participación; no requieren ninguna acción.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {answered.map((survey) => (
                  <div key={survey.id} className="surface-lumen flex items-center gap-4 p-5">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-success/15 text-success">
                      <ClipboardList className="h-5 w-5" strokeWidth={1.7} aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-sm font-bold text-foreground">{survey.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {survey.trainingActivity ? survey.trainingActivity.title : survey.trainingPlan.title}
                      </p>
                    </div>
                    <CircleCheck className="h-5 w-5 shrink-0 text-success" strokeWidth={1.7} aria-hidden="true" />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Salida hacia el plan, para quien no tiene nada pendiente */}
          {disponiblesAhora === 0 && (
            <div className="surface-lumen flex flex-wrap items-center justify-between gap-4 p-6">
              <div className="min-w-0">
                <p className="font-display text-base font-bold text-foreground">No tienes nada pendiente por ahora</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Cuando tu área abra una evaluación o te asigne una encuesta, aparecerá aquí.
                </p>
              </div>
              <Link
                href="/mis-capacitaciones"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-transform duration-150 hover:-translate-y-0.5 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Ver mis capacitaciones
                <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              </Link>
            </div>
          )}
        </StaggerSections>
      </div>
    </main>
  );
}
