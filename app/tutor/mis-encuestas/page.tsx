import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowRight, BookOpen, CheckCircle2, ClipboardCheck, Clock, MessageSquareText, Radio, Users } from "lucide-react";
import { requireTutorOrAdmin } from "@/lib/auth-helpers";
import { getTutorEvaluacionesEnVivo, getTutorEncuestasEnVivo, getTutorCursosEnVivo } from "@/lib/training-plans";
import { MOMENTO_LABEL } from "@/lib/presaber-postsaber";
import { hace } from "@/lib/tutor-dashboard";
import { LiveRefresh } from "@/components/training-plans/live-refresh";
import { ModuloHero } from "@/components/training-plans/modulo-hero";
import { escalon } from "@/components/training-plans/plan-visual";
import { etiquetaHora, tituloLegible } from "@/components/training-plans/labels";
import { EnlacePanel, Medidor, PanelTutor, VacioCompacto } from "@/components/tutor/centro-mando";

export const dynamic = "force-dynamic";

/**
 * CONSOLA DE EVALUACIONES EN VIVO del tutor: observación, no acción.
 *
 * El tutor es quien ABRE la ventana de su capacitación, no quien la
 * presenta -por eso no tiene sentido darle la misma pantalla "entra y
 * respóndela" del estudiante-. Aquí ve, en vivo y a todo el ancho, quién la
 * está presentando ahora mismo y quién ya terminó, ventana por ventana, más
 * la actividad de las evaluaciones de sus cursos y las respuestas a las
 * encuestas de su área. Se refresca sola cada 20 segundos.
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
  const totalRespuestas = encuestas.reduce((s, e) => s + e.totalRespuestas, 0);

  return (
    <div className="space-y-5">
      <LiveRefresh segundos={20} />
      <ModuloHero
        eyebrow="Seguimiento · Consola en vivo"
        Icono={Radio}
        titulo="Evaluaciones"
        acento="en vivo"
        descripcion="Quién está presentando el presaber o el postsaber ahora mismo y quién ya terminó, en las capacitaciones de tus áreas, y las respuestas a tus encuestas."
        cifras={[
          { valor: evaluaciones.length, etiqueta: "Ventanas abiertas", detalle: "Presaber / postsaber" },
          { valor: totalEnProgreso, etiqueta: "Presentando ahora" },
          { valor: totalCompletados, etiqueta: "Completaron", detalle: "En las ventanas vigentes" },
          { valor: promedioGeneral === null ? "—" : `${promedioGeneral}%`, etiqueta: "Promedio general" },
        ]}
      />

      <div className="tut-telemetria revelar" style={escalon(1)}>
        <span className="en-linea">
          <span className="punto-vivo" aria-hidden="true" />
          Transmitiendo
        </span>
        <span>
          Actualización automática cada <b>20 s</b>
        </span>
        <span>
          Corte <b>{etiquetaHora(ahora)}</b>
        </span>
        <span>
          <b>{totalEnProgreso}</b> presentando · <b>{totalRespuestas}</b> respuestas a encuestas
        </span>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-12">
        {/* ── Ventanas abiertas del ciclo ── */}
        <PanelTutor
          indice="01"
          titulo="Ventanas abiertas"
          bajada="Presaber y postsaber habilitados ahora en tus capacitaciones (incluye las de ciclo automático)."
          className="xl:col-span-8"
          style={escalon(2)}
          accion={<EnlacePanel href="/tutor/planes-capacitacion">Mis planes</EnlacePanel>}
        >
          {evaluaciones.length === 0 ? (
            <VacioCompacto Icono={Radio}>
              <b className="font-semibold text-foreground">Sin ventanas abiertas.</b> Cuando habilites un presaber o un postsaber desde la ficha de tu capacitación,
              aparece aquí en vivo.
            </VacioCompacto>
          ) : (
            <div className="grid grid-cols-1 gap-3 2xl:grid-cols-2">
              {evaluaciones.map((e, i) => {
                const nivel = e.promedio === null ? "muted" : e.promedio >= e.passingScore ? "success" : "destructive";
                return (
                  <article key={`${e.activityId}-${e.momento}`} className="tut-ventana revelar" data-momento={e.momento} style={escalon(i + 3)}>
                    <header className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="mono-label truncate">{e.area}</p>
                        <Link
                          href={`/tutor/planes-capacitacion/${e.planId}/actividades/${e.activityId}`}
                          className="mt-0.5 line-clamp-2 text-[13.5px] font-semibold leading-snug text-foreground hover:text-primary"
                        >
                          {tituloLegible(e.titulo)}
                        </Link>
                      </div>
                      <span className="tut-sello shrink-0" style={{ ["--tono" as string]: e.momento === "POSTSABER" ? "var(--primary)" : "var(--warning)" } as CSSProperties}>
                        {MOMENTO_LABEL[e.momento]}
                      </span>
                    </header>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <p className="mono-label flex items-center gap-1.5">
                          {e.enProgreso.length > 0 ? <span className="punto-vivo text-[oklch(0.6_0.21_25)]" aria-hidden="true" /> : <Users className="h-3 w-3" aria-hidden="true" />}
                          Presentando · {e.enProgreso.length}
                        </p>
                        {e.enProgreso.length === 0 ? (
                          <p className="mt-1.5 text-[11.5px] text-muted-foreground">Nadie en este momento.</p>
                        ) : (
                          <ul className="mt-1">
                            {e.enProgreso.slice(0, 6).map((p, j) => (
                              <li key={j} className="tut-persona">
                                <span className="truncate text-foreground">{p.fullName}</span>
                                <span className="flex shrink-0 items-center gap-1 font-mono text-[10px] text-muted-foreground">
                                  <Clock className="h-3 w-3" aria-hidden="true" />
                                  {hace(p.startedAt, ahora)}
                                </span>
                              </li>
                            ))}
                            {e.enProgreso.length > 6 && <li className="mono-label pt-1">+ {e.enProgreso.length - 6} más</li>}
                          </ul>
                        )}
                      </div>
                      <div>
                        <p className="mono-label flex items-center gap-1.5">
                          <CheckCircle2 className="h-3 w-3 text-success" aria-hidden="true" />
                          Completaron · {e.completados.length}
                        </p>
                        {e.completados.length === 0 ? (
                          <p className="mt-1.5 text-[11.5px] text-muted-foreground">Nadie ha terminado todavía.</p>
                        ) : (
                          <ul className="mt-1">
                            {e.completados.slice(0, 6).map((p, j) => (
                              <li key={j} className="tut-persona">
                                <span className="truncate text-foreground">{p.fullName}</span>
                                <span className="tut-nivel shrink-0 text-[11.5px]" data-nivel={p.score >= e.passingScore ? "success" : "destructive"}>
                                  {p.score}%
                                </span>
                              </li>
                            ))}
                            {e.completados.length > 6 && <li className="mono-label pt-1">+ {e.completados.length - 6} más</li>}
                          </ul>
                        )}
                      </div>
                    </div>

                    <footer className="flex flex-wrap items-center gap-3 border-t border-dashed border-border pt-2.5">
                      <div className="min-w-[10rem] flex-1">
                        <Medidor valor={e.promedio} nivel={nivel} meta={e.passingScore} />
                        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                          Promedio <span className="tut-nivel" data-nivel={nivel}>{e.promedio === null ? "—" : `${e.promedio}%`}</span> · aprueba con {e.passingScore}%
                        </p>
                      </div>
                      <Link href={`/tutor/planes-capacitacion/${e.planId}/actividades/${e.activityId}`} className="tut-enlace-panel">
                        Ficha
                        <ArrowRight className="h-3 w-3" aria-hidden="true" />
                      </Link>
                    </footer>
                  </article>
                );
              })}
            </div>
          )}
        </PanelTutor>

        <div className="space-y-5 xl:col-span-4">
          {/* ── Actividad reciente en las evaluaciones de sus capacitaciones ── */}
          <PanelTutor indice="02" titulo="Actividad reciente" bajada="Evaluaciones de tus capacitaciones: intentos abiertos (últimas 2 h) y últimos resultados." style={escalon(3)}>
            {cursos.enProgreso.length === 0 && cursos.terminados.length === 0 ? (
              <VacioCompacto Icono={BookOpen}>Sin actividad reciente en las evaluaciones de tus capacitaciones.</VacioCompacto>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="mono-label flex items-center gap-1.5">
                    {cursos.enProgreso.length > 0 ? <span className="punto-vivo text-[oklch(0.6_0.21_25)]" aria-hidden="true" /> : <Users className="h-3 w-3" aria-hidden="true" />}
                    Presentando · {cursos.enProgreso.length}
                  </p>
                  {cursos.enProgreso.length === 0 ? (
                    <p className="mt-1 text-[11.5px] text-muted-foreground">Nadie en este momento.</p>
                  ) : (
                    <ul className="mt-1">
                      {cursos.enProgreso.map((p, i) => (
                        <li key={i} className="tut-persona">
                          <span className="min-w-0">
                            <span className="block truncate text-foreground">{p.fullName}</span>
                            <span className="block truncate text-[10.5px] text-muted-foreground">{p.curso}</span>
                          </span>
                          <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{hace(p.startedAt, ahora)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <p className="mono-label flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3 text-success" aria-hidden="true" />
                    Últimos resultados · {cursos.terminados.length}
                  </p>
                  <ul className="mt-1">
                    {cursos.terminados.map((p, i) => (
                      <li key={i} className="tut-persona">
                        <span className="min-w-0">
                          <span className="block truncate text-foreground">{p.fullName}</span>
                          <span className="block truncate text-[10.5px] text-muted-foreground">
                            {p.curso} · {hace(p.finishedAt, ahora)}
                          </span>
                        </span>
                        <span className="tut-nivel shrink-0 text-[11.5px]" data-nivel={p.passed ? "success" : "destructive"}>
                          {p.score}%
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </PanelTutor>

          {/* ── Encuestas de opinión de sus áreas ── */}
          <PanelTutor
            indice="03"
            titulo="Encuestas de tu área"
            bajada="Cuántos han respondido y quiénes, lo más reciente primero."
            style={escalon(4)}
            accion={<EnlacePanel href="/encuestas">Encuestas</EnlacePanel>}
          >
            {encuestas.length === 0 ? (
              <VacioCompacto Icono={MessageSquareText}>Las encuestas que crees para tus capacitaciones aparecerán aquí con sus respuestas.</VacioCompacto>
            ) : (
              <ul className="space-y-1">
                {encuestas.map((e) => (
                  <li key={e.id} className="tut-fila items-start">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-primary/25 bg-primary/8 font-mono text-[11px] font-semibold text-primary">
                      {e.totalRespuestas}
                    </span>
                    <div className="min-w-0 flex-1">
                      <Link href={`/encuestas/${e.id}/resultados`} className="principal block truncate text-[13px] font-semibold text-foreground" title={e.titulo}>
                        {e.titulo}
                      </Link>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {e.actividad ? tituloLegible(e.actividad) : "Encuesta del plan"} · {e.totalPreguntas} preguntas
                      </p>
                      {e.ultimasRespuestas.length > 0 && (
                        <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
                          Última: {e.ultimasRespuestas[0].fullName}
                          {e.ultimasRespuestas[0].fecha ? ` · ${hace(e.ultimasRespuestas[0].fecha, ahora)}` : ""}
                        </p>
                      )}
                    </div>
                    <ArrowRight className="flecha mt-1 h-3.5 w-3.5" aria-hidden="true" />
                  </li>
                ))}
              </ul>
            )}
          </PanelTutor>

          <div className="tut-vacio">
            <ClipboardCheck aria-hidden="true" />
            <span>
              Para abrir o cerrar una ventana entra a la ficha de la capacitación, pestaña <b className="font-semibold text-foreground">Evaluación</b>.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
