import Link from "next/link";
import {
  Radio,
  Users,
  CheckCircle2,
  TrendingUp,
  ArrowRight,
  ClipboardList,
  Clock,
} from "lucide-react";
import { requireTutorOrAdmin } from "@/lib/auth-helpers";
import { getTutorEvaluacionesEnVivo, getTutorEncuestasEnVivo, getTutorCursosEnVivo } from "@/lib/training-plans";
import { MOMENTO_LABEL } from "@/lib/presaber-postsaber";
import { EmptyState } from "@/components/brand/empty-state";
import { StaggerSections } from "@/components/brand/stagger-sections";
import { LiveRefresh } from "@/components/training-plans/live-refresh";
import { cn } from "@/lib/utils";

const TIPO_BADGE: Record<"PRESABER" | "POSTSABER", string> = {
  PRESABER: "bg-warning/15 text-warning-foreground",
  POSTSABER: "bg-primary/10 text-primary",
};

/** "Hace X min/h": calculado en el servidor sobre la marca real, sin Intl -evita el problema de hidratación del resto del módulo. */
function hace(fecha: Date, ahora: Date) {
  const minutos = Math.max(0, Math.round((ahora.getTime() - fecha.getTime()) / 60000));
  if (minutos < 1) return "justo ahora";
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.round(minutos / 60);
  return `hace ${horas} h`;
}

/**
 * Panel del TUTOR sobre el ciclo presaber/postsaber: observación, no acción.
 *
 * El tutor es quien ABRE la ventana de su capacitación, no quien la
 * presenta -por eso no tiene sentido darle la misma pantalla "entra y
 * respóndela" del estudiante-. Aquí ve, en vivo, quién la está presentando
 * ahora mismo y quién ya terminó, área por área, con acceso directo al
 * detalle completo de cada capacitación para cerrar la ventana o revisar
 * resultados a fondo.
 */
export default async function TutorMisEncuestasPage() {
  const session = await requireTutorOrAdmin();
  const ahora = new Date();

  const [evaluaciones, encuestas, cursos] = await Promise.all([
    getTutorEvaluacionesEnVivo(session.user.id),
    getTutorEncuestasEnVivo(session.user.id),
    getTutorCursosEnVivo(session.user.id),
  ]);

  const totalEnProgreso = evaluaciones.reduce((s, e) => s + e.enProgreso.length, 0);
  const totalCompletados = evaluaciones.reduce((s, e) => s + e.completados.length, 0);
  const promedios = evaluaciones.map((e) => e.promedio).filter((p): p is number => p !== null);
  const promedioGeneral = promedios.length > 0 ? Math.round(promedios.reduce((s, p) => s + p, 0) / promedios.length) : null;

  const KPIS = [
    { label: "Ventanas abiertas", value: evaluaciones.length, icon: Radio, accent: "primary" as const },
    { label: "Presentando ahora", value: totalEnProgreso, icon: Users, accent: "warning" as const },
    { label: "Completados en esta ventana", value: totalCompletados, icon: CheckCircle2, accent: "success" as const },
    { label: "Promedio general", value: promedioGeneral ?? 0, suffix: promedioGeneral !== null ? "%" : "", icon: TrendingUp, accent: "accent" as const },
  ];
  const KPI_STYLES = {
    primary: { icon: "bg-primary/15 text-primary", glow: "bg-primary/20" },
    accent: { icon: "bg-[var(--accent)]/15 text-[var(--accent)]", glow: "bg-[var(--accent)]/20" },
    success: { icon: "bg-success/15 text-success", glow: "bg-success/20" },
    warning: { icon: "bg-warning/15 text-warning-foreground", glow: "bg-warning/20" },
  } as const;

  return (
    // El shell del tutor ya provee <main> con padding; esta capa solo pinta
    // el lienzo con blobs a sangre completa (márgenes negativos) para que el
    // vidrio tenga color real que difuminar, igual que en el lado estudiante.
    <div className="aula-canvas -m-4 min-h-full sm:-m-6">
      <LiveRefresh segundos={20} />
      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-8 sm:py-12">
        <StaggerSections className="space-y-8">
          {/* Hero */}
          <section className="surface-glass surface-accent-top relative overflow-hidden px-8 py-10 sm:px-12">
            <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-primary/[0.14] blur-[100px]" />
            <div className="relative flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-success/25 bg-success/10 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide text-success">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" aria-hidden="true" />
                  En vivo
                </span>
                <h1 className="mt-4 font-display text-3xl font-extrabold leading-[1.1] tracking-tight text-foreground sm:text-4xl">
                  Evaluaciones de tu área
                </h1>
                <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
                  Quién está presentando el presaber o postsaber ahora mismo, y quién ya terminó, en las capacitaciones que
                  gestionas. Se actualiza solo cada 20 segundos.
                </p>
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
                        {k.suffix ?? ""}
                      </p>
                      <p className="mt-2 text-sm font-bold text-foreground">{k.label}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Ventanas abiertas: quién presenta, quién ya terminó */}
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <span className="h-9 w-1.5 shrink-0 rounded-full bg-gradient-to-b from-primary to-success" />
              <div>
                <h2 className="font-display text-2xl font-extrabold text-foreground">Ventanas abiertas</h2>
                <p className="text-sm text-muted-foreground">Presaber y postsaber que tus áreas tienen habilitados ahora.</p>
              </div>
            </div>

            {evaluaciones.length === 0 ? (
              <EmptyState
                icon={Radio}
                title="Sin ventanas abiertas"
                description="Cuando habilites un presaber o postsaber desde la ficha de tu capacitación, aparecerá aquí en vivo."
              />
            ) : (
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                {evaluaciones.map((e) => (
                  <div key={`${e.activityId}-${e.momento}`} className="surface-glass relative overflow-hidden p-6">
                    <div className="relative space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-primary">{e.area}</p>
                          <p className="mt-0.5 font-display text-base font-bold leading-snug text-foreground">{e.titulo}</p>
                        </div>
                        <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide", TIPO_BADGE[e.momento])}>
                          {MOMENTO_LABEL[e.momento]}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl border border-border/60 p-3">
                          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-warning-foreground">
                            <Users className="h-3.5 w-3.5" aria-hidden="true" />
                            Presentando ({e.enProgreso.length})
                          </p>
                          {e.enProgreso.length === 0 ? (
                            <p className="mt-2 text-xs text-muted-foreground">Nadie en este momento.</p>
                          ) : (
                            <ul className="mt-2 space-y-1.5">
                              {e.enProgreso.slice(0, 5).map((p, i) => (
                                <li key={i} className="flex items-center justify-between gap-2 text-xs">
                                  <span className="truncate font-medium text-foreground">{p.fullName}</span>
                                  <span className="shrink-0 flex items-center gap-1 text-muted-foreground">
                                    <Clock className="h-3 w-3" aria-hidden="true" />
                                    {hace(p.startedAt, ahora)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        <div className="rounded-xl border border-border/60 p-3">
                          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-success">
                            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                            Completaron ({e.completados.length})
                          </p>
                          {e.completados.length === 0 ? (
                            <p className="mt-2 text-xs text-muted-foreground">Nadie ha terminado todavía.</p>
                          ) : (
                            <ul className="mt-2 space-y-1.5">
                              {e.completados.slice(0, 5).map((p, i) => (
                                <li key={i} className="flex items-center justify-between gap-2 text-xs">
                                  <span className="truncate font-medium text-foreground">{p.fullName}</span>
                                  <span
                                    className={cn(
                                      "shrink-0 font-bold",
                                      p.score >= e.passingScore ? "text-success" : "text-destructive"
                                    )}
                                  >
                                    {p.score}%
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t border-border/60 pt-3">
                        <span className="text-xs text-muted-foreground">
                          {e.promedio !== null ? `Promedio: ${e.promedio}% · mínimo ${e.passingScore}%` : `Mínimo para aprobar: ${e.passingScore}%`}
                        </span>
                        <Link
                          href={`/tutor/planes-capacitacion/${e.planId}/actividades/${e.activityId}`}
                          className="flex shrink-0 items-center gap-1 text-xs font-bold text-primary hover:underline"
                        >
                          Ver detalle completo <ArrowRight className="h-3 w-3" aria-hidden="true" />
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Evaluaciones de tus CURSOS (los normales de la plataforma) */}
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <span className="h-9 w-1.5 shrink-0 rounded-full bg-gradient-to-b from-warning to-success" />
              <div>
                <h2 className="font-display text-2xl font-extrabold text-foreground">Evaluaciones de tus cursos</h2>
                <p className="text-sm text-muted-foreground">
                  Actividad en vivo sobre las evaluaciones de los cursos que dictas.
                </p>
              </div>
            </div>

            {cursos.enProgreso.length === 0 && cursos.terminados.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title="Sin actividad reciente"
                description="Cuando alguien presente una evaluación de tus cursos, aparecerá aquí."
              />
            ) : (
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                <div className="surface-glass relative overflow-hidden p-6">
                  <div className="relative space-y-3">
                    <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-warning-foreground">
                      <Users className="h-3.5 w-3.5" aria-hidden="true" />
                      Presentando ahora ({cursos.enProgreso.length})
                    </p>
                    {cursos.enProgreso.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nadie en este momento.</p>
                    ) : (
                      <ul className="space-y-2">
                        {cursos.enProgreso.map((p, i) => (
                          <li key={i} className="flex items-center justify-between gap-3 text-sm">
                            <span className="min-w-0">
                              <span className="block truncate font-medium text-foreground">{p.fullName}</span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {p.curso} · {p.evaluacion}
                              </span>
                            </span>
                            <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" aria-hidden="true" />
                              {hace(p.startedAt, ahora)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                <div className="surface-glass relative overflow-hidden p-6">
                  <div className="relative space-y-3">
                    <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-success">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Últimos resultados ({cursos.terminados.length})
                    </p>
                    {cursos.terminados.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nadie ha terminado todavía.</p>
                    ) : (
                      <ul className="space-y-2">
                        {cursos.terminados.map((p, i) => (
                          <li key={i} className="flex items-center justify-between gap-3 text-sm">
                            <span className="min-w-0">
                              <span className="block truncate font-medium text-foreground">{p.fullName}</span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {p.curso} · {hace(p.finishedAt, ahora)}
                              </span>
                            </span>
                            <span className={cn("shrink-0 text-sm font-bold", p.passed ? "text-success" : "text-destructive")}>
                              {p.score}%
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Encuestas de opinión de tus áreas */}
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <span className="h-9 w-1.5 shrink-0 rounded-full bg-gradient-to-b from-success to-primary" />
              <div>
                <h2 className="font-display text-2xl font-extrabold text-foreground">Encuestas de tu área</h2>
                <p className="text-sm text-muted-foreground">Cuántos han respondido y quiénes, más recientes primero.</p>
              </div>
            </div>

            {encuestas.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title="Sin encuestas activas"
                description="Las encuestas que crees para tus capacitaciones aparecerán aquí con sus respuestas en vivo."
              />
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                {encuestas.map((e) => (
                  <div key={e.id} className="surface-glass relative overflow-hidden p-6">
                    <div className="relative space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-display text-base font-bold leading-snug text-foreground">{e.titulo}</p>
                          {e.actividad && <p className="truncate text-xs text-muted-foreground">{e.actividad}</p>}
                        </div>
                        <span className="shrink-0 rounded-full bg-success/15 px-2.5 py-1 text-[11px] font-bold text-success">
                          {e.totalRespuestas} respuestas
                        </span>
                      </div>

                      {e.ultimasRespuestas.length > 0 && (
                        <ul className="space-y-1.5 border-t border-border/60 pt-3">
                          {e.ultimasRespuestas.map((r, i) => (
                            <li key={i} className="flex items-center justify-between gap-2 text-xs">
                              <span className="truncate font-medium text-foreground">{r.fullName}</span>
                              <span className="shrink-0 text-muted-foreground">{hace(r.fecha, ahora)}</span>
                            </li>
                          ))}
                        </ul>
                      )}

                      <Link
                        href={`/tutor/planes-capacitacion/${e.planId}/encuestas/${e.id}`}
                        className="flex items-center gap-1 border-t border-border/60 pt-3 text-xs font-bold text-primary hover:underline"
                      >
                        Ver resultados completos <ArrowRight className="h-3 w-3" aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </StaggerSections>
      </div>
    </div>
  );
}
