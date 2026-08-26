import Link from "next/link";
import { requireSession } from "@/lib/auth-helpers";
import {
  ClipboardCheck,
  CircleCheck,
  CalendarClock,
  ShieldQuestion,
  History,
  ArrowRight,
} from "lucide-react";
import { getHistorialEvaluaciones, getPromedioEvaluaciones } from "@/lib/training-plans";
import { getTableroEvaluaciones } from "@/lib/tablero-evaluaciones";
import { StaggerSections } from "@/components/brand/stagger-sections";
import { EmptyState } from "@/components/brand/empty-state";
import { TableroEvaluaciones } from "@/components/training-plans/tablero-evaluaciones";
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
  const session = await requireSession("/evaluaciones");
  const userId = session.user.id;
  const primerNombre = session.user.name?.split(" ")[0];

  const [tablero, historial, promedio] = await Promise.all([
    getTableroEvaluaciones(userId),
    getHistorialEvaluaciones(userId),
    getPromedioEvaluaciones(userId),
  ]);
  void promedio; // el promedio vive ahora dentro de cada tarjeta del ciclo

  const disponiblesAhora = tablero.kpis.pendientes;

  // FASE 10: los cuatro indicadores del rediseño.
  const KPIS = [
    {
      valor: String(tablero.kpis.pendientes),
      etiqueta: "Pendientes por presentar",
      icon: ClipboardCheck,
      chip: "bg-warning/18 text-warning-foreground",
      destacar: tablero.kpis.pendientes > 0,
    },
    {
      valor: String(tablero.kpis.ciclosCompletos),
      etiqueta: "Ciclos completos",
      icon: CircleCheck,
      chip: "bg-success/15 text-success",
    },
    {
      valor: String(tablero.kpis.encuestasPendientes),
      etiqueta: "Encuestas pendientes",
      icon: ShieldQuestion,
      chip: "bg-primary/12 text-primary",
    },
    {
      valor: String(tablero.kpis.proximasSesiones),
      etiqueta: "Próximas sesiones presenciales",
      icon: CalendarClock,
      chip: "bg-primary/12 text-primary",
      destacar: tablero.kpis.proximasSesiones > 0,
    },
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

          {/* FASE 10: navegación por CAPACITACIÓN y ciclo, no por examen suelto */}
          <TableroEvaluaciones filas={tablero.filas} />

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
