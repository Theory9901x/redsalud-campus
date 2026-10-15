import Link from "next/link";
import { revalidatePath } from "next/cache";
import type { CSSProperties } from "react";
import {
  ArrowRight,
  Award,
  BookOpen,
  CalendarRange,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  FileText,
  Search,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import type { EnrollmentStatus } from "@prisma/client";
import { requireTutorOrAdmin } from "@/lib/auth-helpers";
import { veComoAdmin } from "@/lib/roles";
import {
  ESTADOS_CURSO,
  ESTADOS_PLAN,
  getAlcanceTutor,
  getDetalleInscripcion,
  getInscritosCursos,
  getPersonasActividad,
  getResumenActividades,
  trimestreDeRevision,
  type EstadoCurso,
  type EstadoPlan,
} from "@/lib/tutor-inscritos";
import { setAttendanceAction } from "@/app/admin/planes-capacitacion/actions";
import { ModuloHero } from "@/components/training-plans/modulo-hero";
import { PildoraEstado, escalon } from "@/components/training-plans/plan-visual";
import { TrimestresChip, nombreTrimestre } from "@/components/training-plans/trimestres-chip";
import { TRAINING_ACTIVITY_STATUS_LABELS, etiquetaDiaMes, tituloLegible } from "@/components/training-plans/labels";
import { Medidor, PanelTutor, VacioCompacto } from "@/components/tutor/centro-mando";
import { Paginacion } from "@/components/tutor/paginacion";

export const dynamic = "force-dynamic";

const RUTA = "/tutor/inscritos";

const ESTADO_INSCRIPCION: Record<EnrollmentStatus, { etiqueta: string; tono: string }> = {
  ACTIVE: { etiqueta: "En curso", tono: "var(--primary)" },
  COMPLETED: { etiqueta: "Completó", tono: "var(--success)" },
  FAILED: { etiqueta: "No aprobó", tono: "var(--destructive)" },
  CANCELLED: { etiqueta: "Cancelada", tono: "var(--muted-foreground)" },
};

const fecha = (f: Date) => {
  const p = etiquetaDiaMes(f);
  return `${p.dia} ${p.mes} ${p.anio}`;
};

/**
 * Asistencia manual desde la lista nominal: delega en setAttendanceAction
 * -la misma acción de la ficha de la capacitación, que valida por sí misma
 * que quien marca responde por esa capacitación y que la jornada no esté
 * cerrada- y refresca esta vista.
 */
async function marcarAsistencia(formData: FormData) {
  "use server";
  const activityId = String(formData.get("activityId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  const t = Number(formData.get("t"));
  await setAttendanceAction(activityId, userId, formData.get("asistio") === "1", t);
  revalidatePath(RUTA);
}

type Params = {
  vista?: string;
  actividad?: string;
  t?: string;
  estado?: string;
  q?: string;
  pagina?: string;
  curso?: string;
  inscripcion?: string;
};

/**
 * INSCRITOS Y PROGRESO: el seguimiento NOMINAL del tutor.
 *
 *   · Capacitaciones del plan: audiencia de cada capacitación de sus áreas,
 *     por trimestre: asistencia, presaber, postsaber y avance en el curso.
 *   · Cursos: inscripciones de los cursos que dicta, con avance.
 *
 * En ambas, el avance lección por lección de una persona se abre al lado.
 * Las inscripciones las asigna el administrador (sus acciones no están
 * habilitadas para el tutor); aquí se consulta y se marca asistencia.
 */
export default async function TutorInscritosPage({ searchParams }: { searchParams: Promise<Params> }) {
  const session = await requireTutorOrAdmin();
  const sp = await searchParams;
  const esAdmin = veComoAdmin(session.user.role);
  const alcance = await getAlcanceTutor(session.user.id);
  const tienePlan = alcance.actividades.length > 0;
  const tieneCursos = alcance.cursos.length > 0;
  const vista: "plan" | "cursos" = sp.vista === "cursos" || (!tienePlan && sp.vista !== "plan") ? "cursos" : "plan";
  const pagina = Math.max(1, Number(sp.pagina) || 1);
  const q = sp.q?.trim() ?? "";

  const url = (cambios: Partial<Params>, base: Params = sp) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...base, ...cambios })) if (v) u.set(k, String(v));
    const s = u.toString();
    return s ? `${RUTA}?${s}` : RUTA;
  };

  const cursosDelPlan = alcance.actividades.flatMap((a) => (a.courseId ? [a.courseId] : []));
  const detalle = sp.inscripcion ? await getDetalleInscripcion(sp.inscripcion, session.user.id, esAdmin, cursosDelPlan) : null;
  const cerrarDetalle = url({ inscripcion: undefined });

  // ── Datos de la vista activa ──
  const actividad = vista === "plan" && sp.actividad ? alcance.actividades.find((a) => a.id === sp.actividad) ?? null : null;
  const revision = actividad ? trimestreDeRevision(actividad, Number(sp.t) || undefined) : null;
  const estadoPlan = (sp.estado && sp.estado in ESTADOS_PLAN ? sp.estado : "todos") as EstadoPlan;
  const estadoCurso = (sp.estado && sp.estado in ESTADOS_CURSO ? sp.estado : "todos") as EstadoCurso;

  const [personas, resumenActividades, inscritos] = await Promise.all([
    actividad && revision ? getPersonasActividad(actividad, { trimestre: revision.elegido, estado: estadoPlan, q, pagina }) : Promise.resolve(null),
    vista === "plan" && !actividad && tienePlan ? getResumenActividades(alcance.actividades) : Promise.resolve(null),
    vista === "cursos" && tieneCursos
      ? getInscritosCursos(session.user.id, { curso: sp.curso, estado: estadoCurso, q, pagina })
      : Promise.resolve(null),
  ]);

  // ── Héroe: cifras de la vista ──
  const cifras =
    vista === "cursos" && inscritos
      ? [
          { valor: inscritos.resumen.activos, etiqueta: "En curso" },
          { valor: inscritos.resumen.completados, etiqueta: "Completaron" },
          { valor: inscritos.resumen.estancados, etiqueta: "Sin avanzar", detalle: "0 % hace más de 7 días" },
          {
            valor: inscritos.resumen.avancePromedio === null ? "—" : `${inscritos.resumen.avancePromedio}%`,
            etiqueta: "Avance promedio",
          },
        ]
      : personas && revision
        ? [
            { valor: personas.resumen.audiencia, etiqueta: "Audiencia", detalle: "Personal objetivo" },
            { valor: personas.resumen.asistieron, etiqueta: `Asistieron T${revision.elegido}` },
            { valor: personas.resumen.presaber, etiqueta: "Presaber", detalle: personas.aprobacion !== null ? `Aprueba con ${personas.aprobacion}%` : "Sin evaluación" },
            { valor: personas.resumen.postsaber, etiqueta: "Postsaber" },
            { valor: personas.resumen.cumplen, etiqueta: personas.resumen.fuente === "AUTOMATIC" ? "Completaron curso" : "Cumplen asistencia" },
            { valor: personas.resumen.adherencia === null ? "—" : `${personas.resumen.adherencia}%`, etiqueta: "Adherencia" },
          ]
        : [
            { valor: alcance.actividades.length, etiqueta: "Capacitaciones" },
            { valor: resumenActividades?.reduce((s, r) => s + r.asistieron, 0) ?? 0, etiqueta: "Asistencias", detalle: "Todos los trimestres" },
            { valor: resumenActividades?.reduce((s, r) => s + (r.evaluados ?? 0), 0) ?? 0, etiqueta: "Evaluados" },
            { valor: alcance.cursos.length, etiqueta: "Cursos que dictas" },
          ];

  return (
    <div className="space-y-5">
      <ModuloHero
        eyebrow={actividad ? `${actividad.area?.name ?? "Plan"} · ${nombreTrimestre(revision!.elegido)}` : "Personas · Seguimiento nominal"}
        Icono={Users}
        titulo={actividad ? tituloLegible(actividad.title) : "Inscritos y"}
        acento={actividad ? undefined : "progreso"}
        descripcion={
          actividad
            ? `${actividad.plan.title}. Quién asistió, quién presentó presaber y postsaber, y cómo va en el curso. Abre a una persona para ver su avance lección por lección.`
            : "Quién está en tus capacitaciones y en tus cursos, qué presentó y cuánto avanzó. Filtra, busca por nombre o documento y abre el avance lección por lección de cada persona."
        }
        columnasCifras={cifras.length > 4 ? 6 : 4}
        cifras={cifras}
        acciones={
          actividad ? (
            <>
              <Link href={`/tutor/planes-capacitacion/${actividad.planId}/actividades/${actividad.id}?t=${revision!.elegido}`} className="boton-hero">
                <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
                Ficha de la capacitación
              </Link>
              <Link href={url({ actividad: undefined, t: undefined, estado: undefined, q: undefined, pagina: undefined, inscripcion: undefined })} className="enlace-hero">
                Todas las capacitaciones
              </Link>
            </>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Vista" className="enc-segmento">
          {tienePlan && (
            <Link href={url({ vista: "plan" }, {})} aria-current={vista === "plan" ? "page" : undefined}>
              <CalendarRange aria-hidden="true" />
              Capacitaciones del plan
              <span className="conteo">{alcance.actividades.length}</span>
            </Link>
          )}
          <Link href={url({ vista: "cursos" }, {})} aria-current={vista === "cursos" ? "page" : undefined}>
            <BookOpen aria-hidden="true" />
            Mis cursos
            <span className="conteo">{alcance.cursos.length}</span>
          </Link>
        </nav>
        <p className="max-w-md text-[11.5px] leading-snug text-muted-foreground">
          Las inscripciones las asigna el administrador. Aquí consultas el avance y, en capacitaciones sin curso, marcas asistencia.
        </p>
      </div>

      <div className={detalle ? "grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_400px]" : ""}>
        <div className="min-w-0 space-y-5">
          {/* ═══════════ PLAN · sin capacitación elegida ═══════════ */}
          {vista === "plan" && !actividad && (
            <PanelTutor indice="01" titulo="Elige una capacitación" bajada="Tus capacitaciones del plan, con su audiencia y participación acumulada." style={escalon(1)}>
              {!resumenActividades || resumenActividades.length === 0 ? (
                <VacioCompacto Icono={CalendarRange}>No tienes capacitaciones del plan a cargo.</VacioCompacto>
              ) : (
                <div className="-mx-1 overflow-x-auto px-1">
                  <table className="tut-tabla min-w-[720px]">
                    <thead>
                      <tr>
                        <th>Capacitación</th>
                        <th>Trimestres</th>
                        <th className="num">Audiencia</th>
                        <th className="num">Asistieron</th>
                        <th className="num">Evaluados</th>
                        <th className="num">Completaron curso</th>
                        <th>Estado</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {alcance.actividades.map((a, i) => {
                        const r = resumenActividades[i];
                        return (
                          <tr key={a.id}>
                            <td className="max-w-[320px]">
                              <Link href={url({ vista: "plan", actividad: a.id }, {})} className="block truncate font-semibold text-foreground hover:text-primary" title={a.title}>
                                {tituloLegible(a.title)}
                              </Link>
                              <p className="truncate text-[11px] text-muted-foreground">
                                {[a.area?.name, a.programa, a.plan.year].filter(Boolean).join(" · ")}
                              </p>
                            </td>
                            <td>
                              <TrimestresChip quarters={a.quarters} tamano="sm" />
                            </td>
                            <td className="num">{r.audiencia}</td>
                            <td className="num">{r.asistieron}</td>
                            <td className="num">{r.evaluados ?? <span className="text-muted-foreground">—</span>}</td>
                            <td className="num">{r.completaron ?? <span className="text-muted-foreground">sin curso</span>}</td>
                            <td>
                              <PildoraEstado estado={a.status}>{TRAINING_ACTIVITY_STATUS_LABELS[a.status]}</PildoraEstado>
                            </td>
                            <td>
                              <Link href={url({ vista: "plan", actividad: a.id }, {})} className="tut-enlace-panel" aria-label={`Ver personas de ${a.title}`}>
                                Personas
                                <ArrowRight className="h-3 w-3" aria-hidden="true" />
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </PanelTutor>
          )}

          {/* ═══════════ PLAN · personas de una capacitación ═══════════ */}
          {actividad && revision && personas && (
            <PanelTutor
              indice="01"
              titulo="Personas de la capacitación"
              bajada={`${personas.total} ${personas.total === 1 ? "persona" : "personas"} con este filtro · ${nombreTrimestre(revision.elegido)}`}
              style={escalon(1)}
            >
              <form action={RUTA} className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:items-end">
                <input type="hidden" name="vista" value="plan" />
                <label className="enc-campo col-span-2">
                  <span>Buscar</span>
                  <span className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <input name="q" defaultValue={q} placeholder="Nombre o documento" className="enc-control enc-con-icono" />
                  </span>
                </label>
                <label className="enc-campo col-span-2">
                  <span>Capacitación</span>
                  <select name="actividad" defaultValue={actividad.id} className="enc-control">
                    {alcance.actividades.map((a) => (
                      <option key={a.id} value={a.id}>
                        {tituloLegible(a.title).slice(0, 70)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="enc-campo">
                  <span>Trimestre</span>
                  <select name="t" defaultValue={String(revision.elegido)} className="enc-control">
                    {[1, 2, 3, 4].map((t) => (
                      <option key={t} value={t}>
                        T{t}
                        {revision.opciones.includes(t) ? "" : " (no programado)"}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="enc-campo">
                  <span>Estado</span>
                  <select name="estado" defaultValue={estadoPlan} className="enc-control">
                    {Object.entries(ESTADOS_PLAN).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" className="enc-boton enc-boton-primario col-span-2 h-[2.4rem] justify-center lg:col-span-2">
                  Filtrar
                </button>
              </form>

              {personas.filas.length === 0 ? (
                <VacioCompacto Icono={Users}>Nadie coincide con este filtro en el {nombreTrimestre(revision.elegido, false)}.</VacioCompacto>
              ) : (
                <div className="-mx-1 overflow-x-auto px-1">
                  <table className="tut-tabla min-w-[760px]">
                    <thead>
                      <tr>
                        <th>Persona</th>
                        <th>Asistencia T{revision.elegido}</th>
                        <th className="num">Presaber</th>
                        <th className="num">Postsaber</th>
                        <th className="w-[22%]">Curso</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {personas.filas.map((p) => {
                        const puedeMarcar = !actividad.courseId && actividad.status !== "CLOSED" && actividad.plan.status !== "CLOSED";
                        const delta = p.presaber !== null && p.postsaber !== null ? p.postsaber - p.presaber : null;
                        return (
                          <tr key={p.id}>
                            <td className="max-w-[260px]">
                              {p.inscripcion ? (
                                <Link href={url({ inscripcion: p.inscripcion.id })} scroll={false} className="block truncate font-semibold text-foreground hover:text-primary">
                                  {p.persona}
                                </Link>
                              ) : (
                                <p className="truncate font-semibold text-foreground">{p.persona}</p>
                              )}
                              <p className="truncate font-mono text-[10.5px] text-muted-foreground">
                                {p.documento}
                                {p.cargo ? <span className="font-sans"> · {p.cargo}</span> : null}
                              </p>
                            </td>
                            <td>
                              <div className="flex flex-wrap items-center gap-2">
                                {p.asistio ? (
                                  <span className="tut-sello" style={{ ["--tono" as string]: "var(--success)" } as CSSProperties}>
                                    <UserCheck className="h-3 w-3" aria-hidden="true" />
                                    Asistió
                                  </span>
                                ) : (
                                  <span className="tut-sello" style={{ ["--tono" as string]: "var(--muted-foreground)" } as CSSProperties}>
                                    {p.registrada ? "No asistió" : "Sin registro"}
                                  </span>
                                )}
                                {p.registrada && (
                                  <span className="font-mono text-[10px] text-muted-foreground">
                                    {fecha(p.registrada)}
                                    {p.fuente === "AUTOMATIC" ? " · auto" : ""}
                                  </span>
                                )}
                                {puedeMarcar && (
                                  <form action={marcarAsistencia}>
                                    <input type="hidden" name="activityId" value={actividad.id} />
                                    <input type="hidden" name="userId" value={p.id} />
                                    <input type="hidden" name="t" value={revision.elegido} />
                                    <input type="hidden" name="asistio" value={p.asistio ? "0" : "1"} />
                                    <button type="submit" className="tut-extra">
                                      {p.asistio ? "Quitar" : "Marcar"}
                                    </button>
                                  </form>
                                )}
                              </div>
                            </td>
                            <td className="num">
                              <Nota valor={p.presaber} aprobacion={personas.aprobacion} />
                            </td>
                            <td className="num">
                              <Nota valor={p.postsaber} aprobacion={personas.aprobacion} />
                              {delta !== null && (
                                <span className={`ml-1 text-[10px] ${delta >= 0 ? "text-success" : "text-destructive"}`}>
                                  {delta >= 0 ? "▲" : "▼"}
                                  {Math.abs(delta)}
                                </span>
                              )}
                            </td>
                            <td>
                              {!actividad.courseId ? (
                                <span className="text-[11px] text-muted-foreground">Sin curso vinculado</span>
                              ) : p.inscripcion ? (
                                <div>
                                  <div className="flex items-center gap-2">
                                    <Medidor valor={p.inscripcion.avance} nivel={p.inscripcion.estado === "COMPLETED" ? "success" : "progreso"} meta={100} className="flex-1" />
                                    <span className="font-mono text-[11px] tabular-nums text-foreground">{p.inscripcion.avance}%</span>
                                  </div>
                                  <p className="mt-0.5 text-[10.5px] text-muted-foreground">{ESTADO_INSCRIPCION[p.inscripcion.estado].etiqueta}</p>
                                </div>
                              ) : (
                                <span className="text-[11px] text-muted-foreground">No ha entrado al curso</span>
                              )}
                            </td>
                            <td className="text-right">
                              {p.inscripcion && (
                                <Link href={url({ inscripcion: p.inscripcion.id })} scroll={false} className="tut-enlace-panel" aria-current={sp.inscripcion === p.inscripcion.id ? "true" : undefined}>
                                  Avance
                                  <ArrowRight className="h-3 w-3" aria-hidden="true" />
                                </Link>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <Paginacion pagina={personas.pagina} paginas={personas.paginas} total={personas.total} href={(n) => url({ pagina: String(n) })} />
            </PanelTutor>
          )}

          {/* ═══════════ CURSOS ═══════════ */}
          {vista === "cursos" && !tieneCursos && (
            <VacioCompacto Icono={BookOpen}>No dictas cursos todavía. Cuando el administrador te asigne uno, sus inscritos aparecerán aquí.</VacioCompacto>
          )}
          {vista === "cursos" && inscritos && (
            <PanelTutor
              indice="01"
              titulo="Inscripciones de tus cursos"
              bajada={`${inscritos.total} ${inscritos.total === 1 ? "inscripción" : "inscripciones"} con este filtro, las más recientes primero.`}
              style={escalon(1)}
            >
              <form action={RUTA} className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-[minmax(0,2fr)_repeat(2,minmax(0,1fr))_auto] lg:items-end">
                <input type="hidden" name="vista" value="cursos" />
                <label className="enc-campo col-span-2 md:col-span-1">
                  <span>Buscar</span>
                  <span className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <input name="q" defaultValue={q} placeholder="Nombre o documento" className="enc-control enc-con-icono" />
                  </span>
                </label>
                <label className="enc-campo">
                  <span>Curso</span>
                  <select name="curso" defaultValue={sp.curso ?? ""} className="enc-control">
                    <option value="">Todos</option>
                    {alcance.cursos.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title.slice(0, 60)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="enc-campo">
                  <span>Estado</span>
                  <select name="estado" defaultValue={estadoCurso} className="enc-control">
                    {Object.entries(ESTADOS_CURSO).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" className="enc-boton enc-boton-primario col-span-2 h-[2.4rem] justify-center lg:col-span-1">
                  Filtrar
                </button>
              </form>

              {inscritos.filas.length === 0 ? (
                <VacioCompacto Icono={Users}>Ninguna inscripción coincide con este filtro.</VacioCompacto>
              ) : (
                <div className="-mx-1 overflow-x-auto px-1">
                  <table className="tut-tabla min-w-[860px]">
                    <thead>
                      <tr>
                        <th>Persona</th>
                        <th>Curso</th>
                        <th>Estado</th>
                        <th className="w-[20%]">Avance</th>
                        <th className="num">Nota</th>
                        <th>Fechas</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {inscritos.filas.map((f) => {
                        const est = ESTADO_INSCRIPCION[f.estado];
                        return (
                          <tr key={f.id}>
                            <td className="max-w-[240px]">
                              <Link href={url({ inscripcion: f.id })} scroll={false} className="block truncate font-semibold text-foreground hover:text-primary">
                                {f.persona}
                              </Link>
                              <p className="truncate font-mono text-[10.5px] text-muted-foreground">
                                {f.documento}
                                {f.cargo ? <span className="font-sans"> · {f.cargo}</span> : null}
                              </p>
                            </td>
                            <td className="max-w-[220px]">
                              <p className="truncate text-[12.5px] text-foreground" title={f.curso}>
                                {f.curso}
                              </p>
                              {f.constancia && (
                                <p className="flex items-center gap-1 font-mono text-[10px] text-success">
                                  <Award className="h-3 w-3" aria-hidden="true" />
                                  {f.constancia}
                                </p>
                              )}
                            </td>
                            <td>
                              <span className="tut-sello" style={{ ["--tono" as string]: est.tono } as CSSProperties}>
                                {est.etiqueta}
                              </span>
                            </td>
                            <td>
                              <div className="flex items-center gap-2">
                                <Medidor valor={f.avance} nivel={f.estado === "COMPLETED" ? "success" : f.estado === "FAILED" ? "destructive" : "progreso"} meta={100} className="flex-1" />
                                <span className="font-mono text-[11px] tabular-nums text-foreground">{f.avance}%</span>
                              </div>
                              <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                                {f.leccionesHechas} de {f.leccionesTotal} lecciones
                              </p>
                            </td>
                            <td className="num">{f.nota !== null ? `${f.nota}%` : <span className="text-muted-foreground">—</span>}</td>
                            <td className="whitespace-nowrap font-mono text-[10.5px] text-muted-foreground">
                              <p>Inscrito {fecha(f.inscrito)}</p>
                              <p>{f.completado ? `Terminó ${fecha(f.completado)}` : f.ultimaActividad ? `Últ. lección ${fecha(f.ultimaActividad)}` : "Sin actividad"}</p>
                            </td>
                            <td className="text-right">
                              <Link href={url({ inscripcion: f.id })} scroll={false} className="tut-enlace-panel">
                                Avance
                                <ArrowRight className="h-3 w-3" aria-hidden="true" />
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <Paginacion pagina={inscritos.pagina} paginas={inscritos.paginas} total={inscritos.total} href={(n) => url({ pagina: String(n) })} />
            </PanelTutor>
          )}
        </div>

        {/* ═══════════ Avance lección por lección ═══════════ */}
        {sp.inscripcion && !detalle && (
          <VacioCompacto Icono={X}>No se encontró esa inscripción o no corresponde a tus cursos ni capacitaciones.</VacioCompacto>
        )}
        {detalle && (
          <aside className="order-first xl:sticky xl:top-20 xl:order-none">
            <PanelTutor
              titulo={detalle.user.fullName}
              bajada={`${detalle.user.documentNumber}${detalle.user.cargo?.nombre ?? detalle.user.position ? ` · ${detalle.user.cargo?.nombre ?? detalle.user.position}` : ""}`}
              accion={
                <Link href={cerrarDetalle} scroll={false} className="tut-enlace-panel" aria-label="Cerrar avance">
                  <X className="h-3 w-3" aria-hidden="true" />
                  Cerrar
                </Link>
              }
              style={escalon(2)}
            >
              <p className="mono-label">Curso</p>
              <p className="mt-0.5 text-[13px] font-semibold leading-snug text-foreground">{detalle.course.title}</p>
              <div className="tut-cifras mt-3" style={{ ["--cols" as string]: 3 }}>
                <div>
                  <b>{detalle.progressPercentage}%</b>
                  <span>Avance</span>
                </div>
                <div>
                  <b>{detalle.finalScore !== null ? `${detalle.finalScore}%` : "—"}</b>
                  <span>Nota final</span>
                </div>
                <div>
                  <b className="!text-[0.8rem]">{ESTADO_INSCRIPCION[detalle.status].etiqueta}</b>
                  <span>Estado</span>
                </div>
              </div>
              <p className="mt-2 font-mono text-[10px] text-muted-foreground">
                Inscrito {fecha(detalle.enrolledAt)}
                {detalle.completedAt ? ` · terminó ${fecha(detalle.completedAt)}` : ""}
                {detalle.certificate?.status === "VALID" ? ` · constancia ${detalle.certificate.certificateCode}` : ""}
              </p>

              <ol className="mt-4 space-y-3">
                {detalle.modulos.map((m, mi) => {
                  const hechas = m.lecciones.filter((l) => l.completada).length;
                  return (
                    <li key={m.id}>
                      <div className="flex items-center gap-2">
                        <span className="grupo-sello !h-7 !w-7 !text-[0.65rem]" aria-hidden="true">
                          {String(mi + 1).padStart(2, "0")}
                        </span>
                        <p className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-foreground">{m.title}</p>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {hechas}/{m.lecciones.length}
                        </span>
                      </div>
                      <ul className="ml-3.5 mt-1 border-l border-dashed border-border pl-4">
                        {m.lecciones.map((l) => (
                          <li key={l.id} className="flex items-center gap-2 py-1 text-[12px]">
                            {l.completada ? (
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" aria-label="Completada" />
                            ) : (
                              <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" aria-label="Pendiente" />
                            )}
                            <span className={`min-w-0 flex-1 truncate ${l.completada ? "text-foreground" : "text-muted-foreground"}`}>{l.title}</span>
                            {l.completadaEl && <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{fecha(l.completadaEl)}</span>}
                          </li>
                        ))}
                        {m.lecciones.length === 0 && <li className="py-1 text-[11.5px] text-muted-foreground">Sin lecciones activas</li>}
                      </ul>
                    </li>
                  );
                })}
              </ol>

              <p className="mono-label mt-5">Evaluaciones presentadas</p>
              {detalle.quizAttempts.length === 0 ? (
                <p className="mt-1 text-[12px] text-muted-foreground">Ningún intento todavía.</p>
              ) : (
                <ul className="mt-1">
                  {detalle.quizAttempts.map((i) => (
                    <li key={i.id} className="tut-persona">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <FileText className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <span className="truncate text-foreground">
                          {i.moment === "PRESABER" ? "Presaber" : i.moment === "POSTSABER" ? "Postsaber" : i.quiz.title}
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground">#{i.attemptNumber}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="font-mono text-[10px] text-muted-foreground">{fecha(i.finishedAt ?? i.startedAt)}</span>
                        {i.score === null ? (
                          <span className="text-[11px] text-muted-foreground">en curso</span>
                        ) : (
                          <span className="tut-nivel text-[12px]" data-nivel={i.passed ? "success" : "destructive"}>
                            {i.score}%
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </PanelTutor>
          </aside>
        )}
      </div>
    </div>
  );
}

function Nota({ valor, aprobacion }: { valor: number | null; aprobacion: number | null }) {
  if (valor === null) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="tut-nivel text-[12.5px]" data-nivel={aprobacion === null ? "muted" : valor >= aprobacion ? "success" : "destructive"}>
      {valor}%
    </span>
  );
}
