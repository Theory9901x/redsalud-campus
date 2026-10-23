import Link from "next/link";
import {
  Activity as ActivityIcon,
  ArrowUpRight,
  CalendarRange,
  ClipboardCheck,
  FileDown,
  LayoutDashboard,
  Radio,
  Sparkles,
  UserCheck,
  Users,
} from "lucide-react";
import { requireSession } from "@/lib/auth-helpers";
import { esCuentaSiau } from "@/lib/encuestas/acceso-siau";
import { getTutorCommandCenter, hace, type EventoFeed } from "@/lib/tutor-dashboard";
import { ModuloHero } from "@/components/training-plans/modulo-hero";
import { Cifra } from "@/components/training-plans/plan-dinamico";
import { AnilloPorcentaje, PildoraEstado, RielTrimestres, escalon } from "@/components/training-plans/plan-visual";
import { nombreTrimestre } from "@/components/training-plans/trimestres-chip";
import {
  TRAINING_ACTIVITY_STATUS_LABELS,
  TRAINING_MODALITY_LABELS,
  etiquetaDiaMes,
  etiquetaHora,
  nivelSemaforo,
  tituloLegible,
} from "@/components/training-plans/labels";
import { ColaAccion, EnlacePanel, Medidor, PanelTutor, VacioCompacto } from "@/components/tutor/centro-mando";
import { PulsoSemanal, type PuntoPulso } from "@/components/tutor/pulso-semanal";

export const dynamic = "force-dynamic";

const DIA = 24 * 60 * 60 * 1000;
const ROMANO = ["I", "II", "III", "IV"];

const ICONO_FEED: Record<EventoFeed["tipo"], typeof UserCheck> = {
  asistencia: UserCheck,
  evaluacion: ClipboardCheck,
};

/** Quién es el tutor, en una línea: un área dentro del PIC, no un docente de cursos. */
const ROL_TUTOR =
  "Gestionas las capacitaciones de tu área en el Plan Institucional de Capacitaciones, concertado por Talento Humano con los procesos.";

const diaMes = (f: Date) => {
  const p = etiquetaDiaMes(f);
  return `${p.dia} ${p.mes}`;
};

/**
 * CENTRO DE MANDO DEL TUTOR. Antes eran cinco contadores de cursos (en 0
 * para los tutores de área, cuyo trabajo es el PLAN) y una gráfica vacía.
 * Ahora responde lo que el tutor necesita al entrar: qué tengo que hacer hoy,
 * cómo va el trimestre, quién está participando y qué ya puedo radicar.
 * Todo sale de lib/tutor-dashboard.ts, acotado a las capacitaciones de sus
 * áreas en el Plan Institucional (sin cursos ni constancias).
 */
export default async function TutorDashboardPage() {
  const session = await requireSession("/tutor");
  const ahora = new Date();
  // La cuenta del área SIAU además consulta y exporta la encuesta de Atención al Usuario.
  const [d, cuentaSiau] = await Promise.all([getTutorCommandCenter(session.user.id, ahora), esCuentaSiau(session)]);

  const nombre = session.user.name?.split(" ")[0] ?? "Tutor";
  const tienePlan = d.kpis.aCargo > 0;
  const tNombre = nombreTrimestre(d.trimestre, false);
  const diasTotales = Math.round((d.rango.hasta.getTime() - d.rango.desde.getTime()) / DIA);
  const diaActual = Math.min(diasTotales, Math.floor((ahora.getTime() - d.rango.desde.getTime()) / DIA) + 1);
  const diasRestantes = Math.max(0, diasTotales - diaActual);
  const enVivoMios = d.enVivo.filter((c) => c.estado === "EN_VIVO").length;
  const sinJornada = d.kpis.delTrimestre - d.kpis.conJornada;

  const pulso: PuntoPulso[] = d.semanas.map((s) => ({
    etiqueta: diaMes(s.desde),
    rango: `${diaMes(s.desde)} – ${diaMes(new Date(s.desde.getTime() + 6 * DIA))}`,
    asistencias: s.asistencias,
    evaluaciones: s.evaluaciones,
  }));
  const totalAsistencias = d.semanas.reduce((s, x) => s + x.asistencias, 0);
  const totalEvaluaciones = d.semanas.reduce((s, x) => s + x.evaluaciones, 0);
  const semanaPico = d.semanas.reduce((m, x) => (x.asistencias + x.evaluaciones > m.asistencias + m.evaluaciones ? x : m), d.semanas[0]);

  const descripcion = (
    <>
      <span className="mb-1.5 block text-white/85">{ROL_TUTOR}</span>
      {tienePlan ? (
        <>
          Hola, {nombre}. Respondes por{" "}
          <b className="font-semibold text-white">{d.areas.length ? d.areas.map((a) => a.name).join(" · ") : "tu plan"}</b>: {d.kpis.aCargo}{" "}
          {d.kpis.aCargo === 1 ? "capacitación" : "capacitaciones"} del {d.anio}. Quedan <b className="font-semibold text-white">{diasRestantes} días</b> del{" "}
          {tNombre}.
        </>
      ) : (
        <>
          Hola, {nombre}. Todavía no tienes capacitaciones del {d.anio} asignadas a tu área: aparecerán aquí cuando Talento Humano las programe en el
          plan.
        </>
      )}
    </>
  );

  return (
    <div className="space-y-5">
      <ModuloHero
        eyebrow={tienePlan ? `Centro de mando · ${d.areas.length === 1 ? `Área ${d.areas[0].name}` : "Tutor de área"}` : "Centro de mando · Tutor"}
        Icono={LayoutDashboard}
        titulo={tienePlan ? "Tu operación del" : "Las capacitaciones"}
        acento={tienePlan ? `trimestre ${ROMANO[d.trimestre - 1]}` : "de tu área"}
        descripcion={descripcion}
        marca={tienePlan ? `T${d.trimestre}` : undefined}
        lateral={
          tienePlan ? (
            <div className="flex flex-col items-center gap-1.5">
              <AnilloPorcentaje valor={d.kpis.adherenciaPromedio} tamano={128} grosor={9} oscuro etiqueta={`Adherencia T${d.trimestre}`} />
              <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-white/45">Meta 85 %</span>
            </div>
          ) : undefined
        }
        columnasCifras={tienePlan ? 6 : undefined}
        cifras={
          tienePlan
            ? [
                { valor: d.kpis.aCargo, etiqueta: "A cargo", detalle: `${d.kpis.abiertas} abiertas · ${d.kpis.cerradas} cerradas` },
                { valor: d.kpis.delTrimestre, etiqueta: `Del T${d.trimestre}`, detalle: nombreTrimestre(d.trimestre) },
                {
                  valor: (
                    <>
                      <Cifra valor={d.kpis.conJornada} />
                      <span className="text-[0.95rem] text-white/40">/{d.kpis.delTrimestre}</span>
                    </>
                  ),
                  etiqueta: "Con jornada",
                  detalle: sinJornada > 0 ? `${sinJornada} por agendar` : "Todas agendadas",
                },
                {
                  valor: d.kpis.adherenciaPromedio === null ? "—" : <Cifra valor={d.kpis.adherenciaPromedio} sufijo="%" />,
                  etiqueta: "Adherencia prom.",
                  detalle: d.kpis.adherenciaPromedio === null ? "Sin audiencia medible" : `Promedio del T${d.trimestre}`,
                },
                { valor: d.kpis.evaluacionesAbiertas, etiqueta: "Evaluaciones abiertas", detalle: "Presaber / postsaber" },
                { valor: d.kpis.asistieronTrimestre, etiqueta: `Asistieron T${d.trimestre}`, detalle: "Personas distintas" },
              ]
            : []
        }
        acciones={
          <>
            <Link href="/tutor/planes-capacitacion" className="boton-hero">
              <CalendarRange className="h-4 w-4" aria-hidden="true" />
              Mis planes
            </Link>
            <Link href="/tutor/planes-capacitacion/en-vivo" className="enlace-hero">
              <Radio className="h-4 w-4" aria-hidden="true" />
              En vivo
              {d.enVivoAhora > 0 && <span className="rounded bg-[oklch(0.58_0.2_25)] px-1.5 font-mono text-[10px] leading-4 text-white">{d.enVivoAhora}</span>}
            </Link>
            {cuentaSiau && (
              <Link href="/encuestas/siau" className="enlace-hero">
                <ActivityIcon className="h-4 w-4" aria-hidden="true" />
                Centro de datos SIAU
              </Link>
            )}
            {tienePlan && (
              <Link href="/tutor/mis-encuestas" className="enlace-hero">
                <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
                Evaluaciones en vivo
              </Link>
            )}
            {d.areas.slice(0, 2).map((a) => (
              <a key={a.id} href={`/api/planes-capacitacion/areas/${a.id}/informe`} className="enlace-hero">
                <FileDown className="h-4 w-4" aria-hidden="true" />
                Informe {d.areas.length > 1 ? a.name : "del área"}
              </a>
            ))}
          </>
        }
        pie={tienePlan ? <RielTrimestres conteos={d.conteoTrimestres} oscuro conMeses /> : undefined}
      />

      {/* Telemetría: dónde estamos parados en el trimestre, de un vistazo. */}
      <div className="tut-telemetria revelar" style={escalon(1)}>
        <span className="en-linea">
          <span className="punto-vivo" aria-hidden="true" />
          En línea
        </span>
        <span>
          <b>{tNombre}</b> · {d.anio}
        </span>
        <span className="avance">
          <span className="whitespace-nowrap">
            Día <b>{diaActual}</b> de {diasTotales}
          </span>
          <span className="tut-reloj" role="img" aria-label={`Avance del trimestre: día ${diaActual} de ${diasTotales}`}>
            <span style={{ width: `${Math.round((diaActual / diasTotales) * 100)}%` }} />
          </span>
          <b>{Math.round((diaActual / diasTotales) * 100)}%</b>
        </span>
        <span>
          En vivo ahora <b>{enVivoMios}</b> tuyas · {d.enVivoAhora} institución
        </span>
        <span className="hidden sm:inline">
          Corte <b>{etiquetaHora(ahora)}</b>
        </span>
      </div>

      {/* ── Fila 1: qué hacer ahora + agenda ── */}
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-12">
        <PanelTutor
          indice="01"
          titulo="Qué hacer ahora"
          bajada="Pendientes en orden de urgencia. Cada fila te lleva a donde se resuelve."
          className={tienePlan ? "xl:col-span-7" : "xl:col-span-12"}
          style={escalon(2)}
          accion={
            d.cola.length > 0 ? (
              <span className="mono-label">
                {d.cola.reduce((s, g) => s + g.entradas.length, 0)} {d.cola.reduce((s, g) => s + g.entradas.length, 0) === 1 ? "pendiente" : "pendientes"}
              </span>
            ) : undefined
          }
        >
          {d.cola.length === 0 ? (
            <VacioCompacto Icono={Sparkles}>
              <b className="font-semibold text-foreground">Todo al día.</b> No hay jornadas por agendar, ventanas abiertas ni informes pendientes.
            </VacioCompacto>
          ) : (
            <ColaAccion grupos={d.cola} />
          )}
        </PanelTutor>

        {tienePlan && (
        <div className="space-y-5 xl:col-span-5">
          <PanelTutor
            indice="02"
            titulo="Agenda · próximos 7 días"
            bajada="Tus jornadas agendadas, con la sala a un clic."
            style={escalon(3)}
            accion={<EnlacePanel href="/tutor/planes-capacitacion/en-vivo">En vivo</EnlacePanel>}
          >
            {d.agenda.length === 0 && d.enVivo.length === 0 ? (
              <VacioCompacto Icono={CalendarRange}>
                {tienePlan ? "Sin jornadas en los próximos 7 días. Agéndalas desde la ficha de cada capacitación." : "Las jornadas aparecen aquí cuando tengas capacitaciones del plan a cargo."}
              </VacioCompacto>
            ) : (
              <ul className="space-y-1">
                {d.agenda.slice(0, 6).map((s) => {
                  const p = etiquetaDiaMes(s.inicio);
                  const vivo = s.enCurso || d.enVivo.some((c) => c.id === s.activityId && c.estado === "EN_VIVO");
                  return (
                    <li key={s.id} className="tut-fila">
                      <span className="tut-fecha" data-hoy={s.hoy} data-vivo={vivo}>
                        <b>{p.dia}</b>
                        <span>{p.mes}</span>
                      </span>
                      <div className="min-w-0 flex-1">
                        <Link href={s.hrefSesion} className="principal block truncate text-[13px] font-semibold text-foreground" title={s.titulo}>
                          {tituloLegible(s.titulo)}
                        </Link>
                        <p className="flex flex-wrap items-center gap-x-2 text-[11.5px] text-muted-foreground">
                          {vivo && <span className="tut-vivo-chip">En vivo</span>}
                          <span className="font-mono">
                            {etiquetaHora(s.inicio)}
                            {s.fin ? ` – ${etiquetaHora(s.fin)}` : ""}
                          </span>
                          <span>· {TRAINING_MODALITY_LABELS[s.modalidad]}</span>
                          {s.lugar && <span className="truncate">· {s.lugar}</span>}
                        </p>
                      </div>
                      {s.modalidad !== "PRESENCIAL" && (
                        <a href={s.hrefSala} target="_blank" rel="noreferrer" className="tut-extra sobre">
                          Sala
                        </a>
                      )}
                      <Link href={s.hrefPanel} className="tut-extra sobre hidden sm:inline-flex">
                        Panel
                      </Link>
                    </li>
                  );
                })}
                {d.enVivo
                  .filter((c) => c.estado === "EN_VIVO" && !d.agenda.some((s) => s.activityId === c.id))
                  .map((c) => (
                    <li key={`vivo-${c.id}`} className="tut-fila">
                      <span className="tut-fecha" data-vivo="true">
                        <Radio className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <Link href={c.hrefPanel} className="principal block truncate text-[13px] font-semibold text-foreground">
                          {tituloLegible(c.titulo)}
                        </Link>
                        <p className="text-[11.5px] text-muted-foreground">
                          <span className="tut-vivo-chip mr-2">En vivo</span>
                          {c.conectados} conectados · sala sin jornada en franja
                        </p>
                      </div>
                      <a href={c.enlace} target="_blank" rel="noreferrer" className="tut-extra sobre">
                        Sala
                      </a>
                    </li>
                  ))}
              </ul>
            )}
            {d.agenda.length > 6 && <p className="mono-label mt-2">+ {d.agenda.length - 6} jornadas más esta semana</p>}
          </PanelTutor>

          {tienePlan && (
            <PanelTutor indice="03" titulo="Avance por trimestre" bajada={`Programadas en el PIC ${d.anio}, con jornada y cerradas.`} style={escalon(4)}>
              <div className="tut-trimestres">
                {d.porTrimestre.map((t) => {
                  const total = Math.max(1, t.programadas);
                  return (
                    <div key={t.t} className="tut-trim" data-estado={t.estado} title={`T${t.t}: ${t.programadas} programadas, ${t.cerradas} cerradas, ${t.jornadaSinCerrar} con jornada sin cerrar, ${t.personas} personas asistieron`}>
                      <div className="t">
                        <span className="inline-flex items-center gap-1.5">
                          {t.estado === "actual" && <span className="punto-vivo" aria-hidden="true" />}T{t.t}
                        </span>
                        <span className="font-normal opacity-70">{ROMANO[t.t - 1]}</span>
                      </div>
                      <p className="n">{t.programadas}</p>
                      <div className="tut-apilada" aria-hidden="true">
                        {t.cerradas > 0 && <span className="cerradas" style={{ width: `${(t.cerradas / total) * 100}%` }} />}
                        {t.jornadaSinCerrar > 0 && <span className="jornada" style={{ width: `${(t.jornadaSinCerrar / total) * 100}%`, animationDelay: "120ms" }} />}
                      </div>
                      <p className="mt-1.5 truncate font-mono text-[10px] text-muted-foreground">
                        <Users className="mr-1 inline h-3 w-3 align-[-2px]" aria-hidden="true" />
                        {t.personas} asist.
                      </p>
                    </div>
                  );
                })}
              </div>
              <div className="tut-leyenda mt-3">
                <span>
                  <i style={{ background: "color-mix(in oklch, var(--foreground) 55%, var(--card))" }} />
                  Cerradas
                </span>
                <span>
                  <i style={{ background: "var(--primary)" }} />
                  Con jornada, sin cerrar
                </span>
                <span>
                  <i style={{ background: "color-mix(in oklch, var(--foreground) 7%, transparent)" }} />
                  Sin jornada
                </span>
              </div>
            </PanelTutor>
          )}
        </div>
        )}
      </div>

      {/* ── Fila 2: adherencia del trimestre + evaluaciones ── */}
      {tienePlan && (
        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-12">
          <PanelTutor
            indice="04"
            titulo={`Adherencia del ${tNombre}`}
            bajada="Por capacitación, de la más rezagada a la más avanzada: personas de la audiencia con asistencia registrada en el trimestre."
            className="xl:col-span-8"
            style={escalon(5)}
            accion={
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                <span className="tut-nivel" data-nivel="success">≥85 cumple</span>
                <span className="tut-nivel" data-nivel="warning">70–84 seguir</span>
                <span className="tut-nivel" data-nivel="destructive">&lt;70 actuar</span>
              </span>
            }
          >
            {d.filasAdherencia.length === 0 ? (
              <VacioCompacto Icono={CalendarRange}>No tienes capacitaciones programadas en el {tNombre}.</VacioCompacto>
            ) : (
              <div className="-mx-1 overflow-x-auto px-1">
                <table className="tut-tabla min-w-[640px]">
                  <thead>
                    <tr>
                      <th>Capacitación</th>
                      <th>Jornada</th>
                      <th className="w-[30%]">Adherencia</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.filasAdherencia.map((f) => {
                      const nivel = nivelSemaforo(f.porcentaje);
                      return (
                        <tr key={f.id}>
                          <td className="max-w-[300px]">
                            <Link href={f.href} className="block truncate font-semibold text-foreground hover:text-primary" title={f.titulo}>
                              {tituloLegible(f.titulo)}
                            </Link>
                            <p className="truncate text-[11px] text-muted-foreground">{[f.area, f.programa].filter(Boolean).join(" · ") || "Plan institucional"}</p>
                          </td>
                          <td className="whitespace-nowrap">
                            {f.jornada ? (
                              <span className="chip-dato font-mono">
                                {diaMes(f.jornada)}
                                {f.jornadas > 1 ? ` +${f.jornadas - 1}` : ""}
                              </span>
                            ) : (
                              <span className="chip-dato chip-dato-alerta">Sin agendar</span>
                            )}
                          </td>
                          <td>
                            <div className="flex items-center gap-2.5">
                              <Medidor valor={f.porcentaje} nivel={nivel} className="flex-1" />
                              <span className="tut-nivel w-10 text-right text-[12.5px]" data-nivel={nivel}>
                                {f.porcentaje === null ? "—" : `${f.porcentaje}%`}
                              </span>
                            </div>
                            <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                              {f.esperados > 0 ? `${f.cumplen} de ${f.esperados} personas` : "Sin audiencia objetivo"}
                            </p>
                          </td>
                          <td>
                            <PildoraEstado estado={f.estado}>{TRAINING_ACTIVITY_STATUS_LABELS[f.estado]}</PildoraEstado>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </PanelTutor>

          <PanelTutor
            indice="05"
            titulo="Evaluaciones abiertas"
            bajada="Presaber y postsaber disponibles ahora en tus capacitaciones."
            className="xl:col-span-4"
            style={escalon(6)}
            accion={<EnlacePanel href="/tutor/mis-encuestas">Consola</EnlacePanel>}
          >
            {d.evaluaciones.length === 0 ? (
              <VacioCompacto Icono={ClipboardCheck}>
                Ninguna abierta. Cada capacitación abre su presaber y su postsaber desde la ficha.
              </VacioCompacto>
            ) : (
              <ul className="space-y-1">
                {d.evaluaciones.slice(0, 7).map((e) => (
                  <li key={e.id} className="tut-fila">
                    <div className="min-w-0 flex-1">
                      <Link href={e.href} className="principal block truncate text-[13px] font-semibold text-foreground" title={e.titulo}>
                        {tituloLegible(e.titulo)}
                      </Link>
                      <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span className="chip-dato chip-dato-primario">{e.automatico ? "Ciclo automático" : e.momento === "POSTSABER" ? "Postsaber" : "Presaber"}</span>
                        {e.presentando > 0 ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-[oklch(0.6_0.21_25)]">
                            <span className="punto-vivo" aria-hidden="true" />
                            {e.presentando} presentando
                          </span>
                        ) : null}
                        <span className="font-mono">{e.terminaron} terminaron T{d.trimestre}</span>
                      </p>
                    </div>
                    <ArrowUpRight className="flecha h-3.5 w-3.5" aria-hidden="true" />
                  </li>
                ))}
              </ul>
            )}
            {d.evaluaciones.length > 7 && <p className="mono-label mt-2">+ {d.evaluaciones.length - 7} más en la consola</p>}
          </PanelTutor>
        </div>
      )}

      {/* ── Fila 3: pulso + actividad reciente ── */}
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-12">
        {tienePlan && (
          <PanelTutor
            indice="06"
            titulo="Pulso de participación"
            bajada="Últimas 12 semanas en tus capacitaciones: asistencias registradas y evaluaciones presentadas."
            className="xl:col-span-7"
            style={escalon(7)}
          >
            <div className="tut-cifras mb-4" style={{ ["--cols" as string]: 3 }}>
              <div>
                <b>
                  <Cifra valor={totalAsistencias} />
                </b>
                <span>Asistencias</span>
              </div>
              <div>
                <b>
                  <Cifra valor={totalEvaluaciones} />
                </b>
                <span>Evaluaciones</span>
              </div>
              <div>
                <b>{semanaPico && semanaPico.asistencias + semanaPico.evaluaciones > 0 ? diaMes(semanaPico.desde) : "—"}</b>
                <span>Semana pico</span>
              </div>
            </div>
            <PulsoSemanal datos={pulso} />
          </PanelTutor>
        )}

        <PanelTutor
          indice={tienePlan ? "07" : "02"}
          titulo="Actividad reciente"
          bajada="Asistencias y evaluaciones en tus capacitaciones, lo último primero."
          className={tienePlan ? "xl:col-span-5" : "xl:col-span-12"}
          style={escalon(8)}
        >
          {d.feed.length === 0 ? (
            <VacioCompacto Icono={ActivityIcon}>Sin movimiento todavía. Aquí aparece cada asistencia o evaluación en tus capacitaciones.</VacioCompacto>
          ) : (
            <ol className="tut-feed space-y-2.5">
              {d.feed.slice(0, 8).map((e, i) => {
                const Icono = ICONO_FEED[e.tipo];
                return (
                  <li key={i} className="flex items-start gap-3">
                    <span className="tut-feed-nodo" data-tipo={e.tipo}>
                      <Icono className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <p className="text-[12.5px] leading-snug text-foreground">
                        <b className="font-semibold">{e.quien}</b> <span className="text-muted-foreground">{tituloLegible(e.texto)}</span>
                      </p>
                      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{hace(e.at, ahora)}</p>
                    </div>
                    {e.dato && (
                      <span className="tut-nivel shrink-0 pt-0.5 text-[12px]" data-nivel={e.tipo === "evaluacion" ? (e.positivo ? "success" : "destructive") : "muted"}>
                        {e.dato}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </PanelTutor>
      </div>

    </div>
  );
}
