import Link from "next/link";
import { revalidatePath } from "next/cache";
import type { CSSProperties } from "react";
import { ArrowRight, CalendarRange, ClipboardCheck, Search, UserCheck, Users } from "lucide-react";
import { requireTutorOrAdmin } from "@/lib/auth-helpers";
import {
  ESTADOS_PLAN,
  getAlcanceTutor,
  getPersonasActividad,
  getResumenActividades,
  trimestreDeRevision,
  type EstadoPlan,
} from "@/lib/tutor-inscritos";
import { setAttendanceAction } from "@/app/admin/planes-capacitacion/actions";
import { ModuloHero } from "@/components/training-plans/modulo-hero";
import { PildoraEstado, escalon } from "@/components/training-plans/plan-visual";
import { TrimestresChip, nombreTrimestre } from "@/components/training-plans/trimestres-chip";
import { TRAINING_ACTIVITY_STATUS_LABELS, etiquetaDiaMes, tituloLegible } from "@/components/training-plans/labels";
import { PanelTutor, VacioCompacto } from "@/components/tutor/centro-mando";
import { Paginacion } from "@/components/tutor/paginacion";

export const dynamic = "force-dynamic";

const RUTA = "/tutor/inscritos";

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
  actividad?: string;
  t?: string;
  estado?: string;
  q?: string;
  pagina?: string;
};

/**
 * PARTICIPANTES: el seguimiento NOMINAL de las capacitaciones del área en el
 * Plan Institucional de Capacitaciones. Por capacitación y por trimestre:
 * quién de la audiencia asistió, quién presentó presaber y postsaber, y la
 * adherencia por asistencia. Aquí se consulta y se marca asistencia; no hay
 * cursos, inscripciones ni constancias (el plan no las genera).
 */
export default async function TutorParticipantesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const session = await requireTutorOrAdmin();
  const sp = await searchParams;
  const alcance = await getAlcanceTutor(session.user.id);
  const tienePlan = alcance.actividades.length > 0;
  const pagina = Math.max(1, Number(sp.pagina) || 1);
  const q = sp.q?.trim() ?? "";

  const url = (cambios: Partial<Params>, base: Params = sp) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...base, ...cambios })) if (v) u.set(k, String(v));
    const s = u.toString();
    return s ? `${RUTA}?${s}` : RUTA;
  };

  // ── Datos de la vista activa ──
  const actividad = sp.actividad ? alcance.actividades.find((a) => a.id === sp.actividad) ?? null : null;
  const revision = actividad ? trimestreDeRevision(actividad, Number(sp.t) || undefined) : null;
  const estadoPlan = (sp.estado && sp.estado in ESTADOS_PLAN ? sp.estado : "todos") as EstadoPlan;

  const [personas, resumenActividades] = await Promise.all([
    actividad && revision ? getPersonasActividad(actividad, { trimestre: revision.elegido, estado: estadoPlan, q, pagina }) : Promise.resolve(null),
    !actividad && tienePlan ? getResumenActividades(alcance.actividades) : Promise.resolve(null),
  ]);

  // ── Héroe: cifras de la vista ──
  const cifras =
    personas && revision
      ? [
          { valor: personas.resumen.audiencia, etiqueta: "Audiencia", detalle: "Personal objetivo" },
          { valor: personas.resumen.asistieron, etiqueta: `Asistieron T${revision.elegido}`, detalle: "Personas distintas" },
          { valor: personas.resumen.presaber, etiqueta: "Presaber", detalle: personas.aprobacion !== null ? `Aprueba con ${personas.aprobacion}%` : "Sin evaluación" },
          { valor: personas.resumen.postsaber, etiqueta: "Postsaber" },
          { valor: personas.resumen.cumplen, etiqueta: "Audiencia que asistió", detalle: `En el T${revision.elegido}` },
          { valor: personas.resumen.adherencia === null ? "—" : `${personas.resumen.adherencia}%`, etiqueta: "Adherencia", detalle: "Por asistencia" },
        ]
      : [
          { valor: alcance.actividades.length, etiqueta: "Capacitaciones" },
          { valor: resumenActividades?.reduce((s, r) => s + r.asistieron, 0) ?? 0, etiqueta: "Asistencias", detalle: "Todos los trimestres" },
          { valor: resumenActividades?.reduce((s, r) => s + (r.evaluados ?? 0), 0) ?? 0, etiqueta: "Evaluados", detalle: "Presaber o postsaber" },
          { valor: alcance.areas.length, etiqueta: alcance.areas.length === 1 ? "Área a cargo" : "Áreas a cargo" },
        ];

  return (
    <div className="space-y-5">
      <ModuloHero
        eyebrow={actividad ? `${actividad.area?.name ?? "Plan"} · ${nombreTrimestre(revision!.elegido)}` : "Personas · Plan Institucional de Capacitaciones"}
        Icono={Users}
        titulo={actividad ? tituloLegible(actividad.title) : "Participantes de"}
        acento={actividad ? undefined : "tus capacitaciones"}
        descripcion={
          actividad
            ? `${actividad.plan.title}. Quién de la audiencia asistió en el trimestre y quién presentó presaber y postsaber.`
            : "Quién participa en las capacitaciones de tu área, por capacitación y por trimestre: asistencia registrada y resultados de presaber y postsaber. Filtra y busca por nombre o documento."
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
              <Link href={RUTA} className="enlace-hero">
                Todas las capacitaciones
              </Link>
            </>
          ) : undefined
        }
      />

      {/* ═══════════ Sin capacitación elegida ═══════════ */}
      {!actividad && (
        <PanelTutor indice="01" titulo="Elige una capacitación" bajada="Las capacitaciones de tu área en el plan, con su audiencia y participación acumulada." style={escalon(1)}>
          {!resumenActividades || resumenActividades.length === 0 ? (
            <VacioCompacto Icono={CalendarRange}>Tu área todavía no tiene capacitaciones en el plan.</VacioCompacto>
          ) : (
            <div className="-mx-1 overflow-x-auto px-1">
              <table className="tut-tabla min-w-[640px]">
                <thead>
                  <tr>
                    <th>Capacitación</th>
                    <th>Trimestres</th>
                    <th className="num">Audiencia</th>
                    <th className="num">Asistieron</th>
                    <th className="num">Evaluados</th>
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
                          <Link href={url({ actividad: a.id }, {})} className="block truncate font-semibold text-foreground hover:text-primary" title={a.title}>
                            {tituloLegible(a.title)}
                          </Link>
                          <p className="truncate text-[11px] text-muted-foreground">{[a.area?.name, a.programa, a.plan.year].filter(Boolean).join(" · ")}</p>
                        </td>
                        <td>
                          <TrimestresChip quarters={a.quarters} tamano="sm" />
                        </td>
                        <td className="num">{r.audiencia}</td>
                        <td className="num">{r.asistieron}</td>
                        <td className="num">{r.evaluados ?? <span className="text-muted-foreground">—</span>}</td>
                        <td>
                          <PildoraEstado estado={a.status}>{TRAINING_ACTIVITY_STATUS_LABELS[a.status]}</PildoraEstado>
                        </td>
                        <td>
                          <Link href={url({ actividad: a.id }, {})} className="tut-enlace-panel" aria-label={`Ver participantes de ${a.title}`}>
                            Participantes
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

      {/* ═══════════ Participantes de una capacitación ═══════════ */}
      {actividad && revision && personas && (
        <PanelTutor
          indice="01"
          titulo="Participantes de la capacitación"
          bajada={`${personas.total} ${personas.total === 1 ? "persona" : "personas"} con este filtro · ${nombreTrimestre(revision.elegido)}`}
          style={escalon(1)}
        >
          <form action={RUTA} className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:items-end">
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
              <table className="tut-tabla min-w-[620px]">
                <thead>
                  <tr>
                    <th>Persona</th>
                    <th>Asistencia T{revision.elegido}</th>
                    <th className="num">Presaber</th>
                    <th className="num">Postsaber</th>
                  </tr>
                </thead>
                <tbody>
                  {personas.filas.map((p) => {
                    const puedeMarcar = actividad.status !== "CLOSED" && actividad.plan.status !== "CLOSED";
                    const delta = p.presaber !== null && p.postsaber !== null ? p.postsaber - p.presaber : null;
                    return (
                      <tr key={p.id}>
                        <td className="max-w-[300px]">
                          <p className="truncate font-semibold text-foreground">{p.persona}</p>
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
