import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  Building2,
  CalendarRange,
  Download,
  Gauge,
  Layers3,
  PhoneCall,
  Radar,
  Timer,
  UserRound,
  Users2,
} from "lucide-react";
import { TablePagination } from "@/components/admin/table-pagination";
import { tituloLegible } from "@/components/training-plans/labels";
import { escalon } from "@/components/training-plans/plan-visual";
import { FiltrosTrazabilidad } from "@/components/trazabilidad/filtros-trazabilidad";
import type { AlcanceTrazabilidad, CapacitacionTrazada, FilaPersona, TrazabilidadPlan } from "@/lib/trazabilidad-llamadas";
import { cn } from "@/lib/utils";

/* Todo el formato de fechas ocurre en el servidor (este componente no es de
   cliente): no hay hidratación que pueda desfasarse con el reloj del navegador. */
const normalizar = (s: string) => s.replace(/\s/g, " ");
const FECHA_HORA = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" });
const FECHA_LARGA = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" });
const fechaHora = (d: Date | string) => normalizar(FECHA_HORA.format(new Date(d)));
const fechaLarga = (d: Date | string) => normalizar(FECHA_LARGA.format(new Date(d)));

export function duracion(minutos: number): string {
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

const ROMANOS = ["I", "II", "III", "IV"];
const PALETA = 8; // tonos distintos por área (ver .traz-area[data-tono])

type Parametros = { t: number | null; area: string; actividad: string; q: string };

function conParametros(base: string, p: Partial<Parametros> & { page?: string }, extra?: string) {
  const sp = new URLSearchParams();
  if (p.t) sp.set("t", String(p.t));
  if (p.area) sp.set("area", p.area);
  if (p.actividad) sp.set("actividad", p.actividad);
  if (p.q) sp.set("q", p.q);
  if (p.page) sp.set("page", p.page);
  const cadena = sp.toString();
  return `${base}${cadena ? `?${cadena}` : ""}${extra ?? ""}`;
}

/**
 * TRAZABILIDAD DE CONEXIONES, por ÁREA → CAPACITACIÓN → TRIMESTRE.
 *
 * Panel de monitoreo con el lenguaje de las fichas EN VIVO (vidrio, aurora,
 * telemetría en monoespaciada, un tono por área) y no el héroe navy del resto
 * del módulo: aquí se audita, no se gestiona.
 */
export function VistaTrazabilidad({
  alcance,
  datos,
  personas,
  basePath,
  parametros,
}: {
  alcance: AlcanceTrazabilidad;
  datos: TrazabilidadPlan;
  personas: { filas: FilaPersona[]; total: number; pagina: number; porPagina: number; minutosMaximo: number };
  basePath: string;
  parametros: Parametros;
}) {
  const { plan, institucional } = alcance;
  const paginaActual = `${basePath}/${plan.id}/conexiones`;
  const r = datos.resumen;
  const maxTrimestre = Math.max(1, ...datos.porTrimestre.map((t) => t.minutos));
  const etiquetaPeriodo = datos.trimestre ? `${ROMANOS[datos.trimestre - 1]} trimestre ${datos.anio}` : `Año ${datos.anio} completo`;
  const sinDatos = r.tramos === 0;

  const capacitaciones = datos.areas.flatMap((a) => a.capacitaciones);
  const capacitacionesVisibles = capacitaciones.filter(
    (c) => (!parametros.area || (c.areaId ?? "sin-area") === parametros.area) && (!parametros.actividad || c.id === parametros.actividad)
  );
  const tonoDeArea = new Map(datos.areas.map((a) => [a.id, a.indice % PALETA]));
  // Excel con hojas por área, por capacitación y por persona (el CSV queda
  // solo para enlaces viejos: nadie lo usa).
  const excelHref = `/api/planes-capacitacion/${plan.id}/conexiones/excel${conParametros("", parametros)}`;

  const kpis = [
    { Icono: Users2, etiqueta: "Personas conectadas", valor: String(r.personas), nota: r.externos > 0 ? `${r.personasInternas} con cuenta · ${r.externos} externas` : "todas con cuenta" },
    { Icono: Timer, etiqueta: "Minutos en la sala", valor: duracion(r.minutos), nota: `${r.tramos} ${r.tramos === 1 ? "tramo" : "tramos"} de conexión` },
    { Icono: Gauge, etiqueta: "Permanencia promedio", valor: duracion(r.permanenciaPromedioMin), nota: `mediana ${duracion(r.permanenciaMedianaMin)}` },
    { Icono: Layers3, etiqueta: "Capacitaciones en vivo", valor: String(r.capacitaciones), nota: `${r.jornadas} ${r.jornadas === 1 ? "jornada agendada" : "jornadas agendadas"}` },
    { Icono: Building2, etiqueta: institucional ? "Áreas con conexión" : "Mis áreas con conexión", valor: String(r.areas), nota: institucional ? "alcance institucional" : "solo las áreas a mi cargo" },
  ];

  return (
    <div className="traz space-y-8">
      {/* ── Cabecera de monitoreo ─────────────────────────────────────── */}
      <section className="traz-cabecera revelar" aria-label="Resumen de conexiones">
        <span className="traz-aurora" aria-hidden="true" />
        <span className="traz-aurora traz-aurora-b" aria-hidden="true" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <Link href={`${basePath}/${plan.id}`} className="traz-volver">
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              {plan.title}
            </Link>
            <p className="mono-label mt-4 flex items-center gap-2">
              <PhoneCall className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              Conexiones a la sala · Trazabilidad
            </p>
            <h1 className="traz-titulo">
              {institucional ? "Trazabilidad institucional" : "Trazabilidad de mis áreas"}
              <span className="traz-titulo-periodo">{etiquetaPeriodo}</span>
            </h1>
            <p className="traz-desc">
              Cuánto tiempo estuvo conectada cada persona a la sala de cada jornada virtual, organizado por área, por
              capacitación y por trimestre. Se registra solo, al salir de la sala; nadie lo marca a mano.
            </p>
          </div>
          <div className="traz-sello-bloque">
            <span className="traz-sello">
              <Radar className="h-3.5 w-3.5" aria-hidden="true" />
              {datos.ultimaConexion ? `Último registro · ${fechaLarga(datos.ultimaConexion)}` : "Sin registros todavía"}
            </span>
            <a href={excelHref} className="traz-exportar" download>
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              Exportar Excel
            </a>
          </div>
        </div>

        {/* Selector de trimestre con la tira de minutos del año: contexto antes de elegir. */}
        <nav className="traz-trimestres relative" aria-label="Periodo">
          <Link href={conParametros(paginaActual, { ...parametros, t: null })} className="traz-trimestre" data-activo={!datos.trimestre || undefined} scroll={false}>
            <span className="traz-trimestre-nombre">Todo el año</span>
            <b>{duracion(datos.porTrimestre.reduce((s, t) => s + t.minutos, 0))}</b>
            <small>{datos.anio}</small>
          </Link>
          {datos.porTrimestre.map((t) => (
            <Link
              key={t.trimestre}
              href={conParametros(paginaActual, { ...parametros, t: t.trimestre })}
              className="traz-trimestre"
              data-activo={datos.trimestre === t.trimestre || undefined}
              data-en-curso={datos.trimestreEnCurso === t.trimestre || undefined}
              data-vacio={t.tramos === 0 || undefined}
              scroll={false}
            >
              <span className="traz-trimestre-nombre">
                T{t.trimestre}
                {datos.trimestreEnCurso === t.trimestre && <i>en curso</i>}
              </span>
              <b>{t.tramos === 0 ? "—" : duracion(t.minutos)}</b>
              <small>{t.tramos === 0 ? "sin conexiones" : `${t.personas} ${t.personas === 1 ? "persona" : "personas"}`}</small>
              <span className="traz-trimestre-barra" aria-hidden="true">
                <span style={{ width: `${Math.max(t.minutos > 0 ? 4 : 0, Math.round((t.minutos / maxTrimestre) * 100))}%` }} />
              </span>
            </Link>
          ))}
        </nav>

        <div className="traz-kpis relative">
          {kpis.map((k, i) => (
            <article key={k.etiqueta} className="traz-kpi revelar" style={escalon(i)}>
              <span className="traz-kpi-icono">
                <k.Icono className="h-4 w-4" aria-hidden="true" />
              </span>
              <p className="traz-kpi-valor">{k.valor}</p>
              <p className="mono-label">{k.etiqueta}</p>
              <p className="traz-kpi-nota">{k.nota}</p>
            </article>
          ))}
        </div>
      </section>

      {sinDatos ? (
        <div className="traz-vacio">
          <PhoneCall className="h-6 w-6" aria-hidden="true" />
          <div>
            <p className="font-semibold text-foreground">Sin conexiones en {etiquetaPeriodo.toLowerCase()}.</p>
            <p>
              Los tramos se escriben solos en cuanto alguien sale de la sala de una capacitación en vivo de este plan.
              {datos.trimestre ? " Prueba con otro trimestre o con el año completo." : ""}
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* ── Por área ─────────────────────────────────────────────── */}
          <section className="space-y-4" aria-labelledby="traz-areas">
            <Cabecera id="traz-areas" Icono={Building2} titulo="Por área" nota={`${datos.areas.length} ${datos.areas.length === 1 ? "área con conexiones" : "áreas con conexiones"} · ordenadas como en el catálogo`} />
            <div className={cn("grid gap-4", datos.areas.length > 1 && "lg:grid-cols-2", datos.areas.length > 2 && "2xl:grid-cols-3")}>
              {datos.areas.map((area, i) => {
                const maxMin = Math.max(1, ...area.capacitaciones.map((c) => c.kpis.minutos));
                const visibles = area.capacitaciones.slice(0, 5);
                const activa = parametros.area === area.id;
                return (
                  <article key={area.id} className="traz-area revelar" data-tono={area.indice % PALETA} data-activa={activa || undefined} style={escalon(i)}>
                    <span className="traz-aurora" aria-hidden="true" />
                    <header className="relative flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="mono-label">Área {String(i + 1).padStart(2, "0")}</p>
                        <h3 className="traz-area-nombre">{area.nombre}</h3>
                      </div>
                      <span className="traz-area-personas" title="Personas distintas conectadas">
                        <Users2 className="h-3.5 w-3.5" aria-hidden="true" />
                        {area.kpis.personas}
                      </span>
                    </header>

                    <dl className="traz-datos relative">
                      <div>
                        <dt>Minutos</dt>
                        <dd>{duracion(area.kpis.minutos)}</dd>
                      </div>
                      <div>
                        <dt>Permanencia</dt>
                        <dd>
                          {duracion(area.kpis.permanenciaPromedioMin)}
                          <small>mediana {duracion(area.kpis.permanenciaMedianaMin)}</small>
                        </dd>
                      </div>
                      <div>
                        <dt>Tramos</dt>
                        <dd>{area.kpis.tramos}</dd>
                      </div>
                      <div>
                        <dt>Capacitaciones</dt>
                        <dd>{area.capacitaciones.length}</dd>
                      </div>
                    </dl>

                    <div className="traz-barras relative" role="list" aria-label={`Minutos por capacitación en ${area.nombre}`}>
                      {visibles.map((c) => (
                        <Link
                          key={c.id}
                          role="listitem"
                          href={conParametros(paginaActual, { ...parametros, area: area.id, actividad: c.id }, "#capacitaciones")}
                          className="traz-barra"
                          scroll={false}
                          title={`${tituloLegible(c.titulo)} · ${duracion(c.kpis.minutos)} · ${c.kpis.personas} personas`}
                        >
                          <span className="traz-barra-texto">
                            <span className="truncate">{tituloLegible(c.titulo)}</span>
                            <b>{duracion(c.kpis.minutos)}</b>
                          </span>
                          <span className="traz-barra-riel" aria-hidden="true">
                            <span style={{ width: `${Math.max(3, Math.round((c.kpis.minutos / maxMin) * 100))}%` }} />
                          </span>
                        </Link>
                      ))}
                      {area.capacitaciones.length > visibles.length && (
                        <p className="traz-barra-mas">y {area.capacitaciones.length - visibles.length} más</p>
                      )}
                    </div>

                    <div className="relative mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
                      <span className="traz-pie">
                        {area.kpis.externos > 0 ? `${area.kpis.externos} ${area.kpis.externos === 1 ? "externo" : "externos"}` : "sin externos"}
                      </span>
                      <Link
                        href={conParametros(paginaActual, { ...parametros, area: activa ? "" : area.id, actividad: "" }, "#capacitaciones")}
                        className="traz-enlace"
                        scroll={false}
                      >
                        {activa ? "Quitar filtro" : "Ver sus capacitaciones"}
                        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {/* ── Por capacitación ─────────────────────────────────────── */}
          <section className="space-y-4 scroll-mt-24" id="capacitaciones" aria-labelledby="traz-capacitaciones">
            <Cabecera
              id="traz-capacitaciones"
              Icono={Layers3}
              titulo="Por capacitación"
              nota={
                capacitacionesVisibles.length === capacitaciones.length
                  ? `${capacitaciones.length} con conexiones · ordenadas por minutos`
                  : `${capacitacionesVisibles.length} de ${capacitaciones.length} · filtradas por ${parametros.actividad ? "capacitación" : "área"}`
              }
              accion={
                parametros.area || parametros.actividad ? (
                  <Link href={conParametros(paginaActual, { t: parametros.t, q: parametros.q }, "#capacitaciones")} className="traz-enlace" scroll={false}>
                    Ver todas
                  </Link>
                ) : null
              }
            />
            <div className="traz-lista">
              <div className="traz-lista-cab" aria-hidden="true">
                <span>Capacitación</span>
                <span>Trimestres</span>
                <span className="text-right">Jornadas</span>
                <span className="text-right">Personas</span>
                <span className="text-right">Permanencia</span>
                <span className="text-right">Minutos</span>
                <span className="text-right">Audiencia</span>
                <span />
              </div>
              {capacitacionesVisibles.map((c, i) => (
                <FilaCapacitacion
                  key={c.id}
                  c={c}
                  tono={tonoDeArea.get(c.areaId ?? "sin-area") ?? 0}
                  i={i}
                  href={`${basePath}/${plan.id}/actividades/${c.id}${parametros.t ? `?t=${parametros.t}` : ""}`}
                  trimestre={parametros.t}
                />
              ))}
              {capacitacionesVisibles.length === 0 && <p className="traz-lista-vacia">Ninguna capacitación coincide con el filtro.</p>}
            </div>
          </section>

          {/* ── Detalle por persona ──────────────────────────────────── */}
          <section className="space-y-4 scroll-mt-24" id="personas" aria-labelledby="traz-personas">
            <Cabecera
              id="traz-personas"
              Icono={UserRound}
              titulo="Detalle por persona"
              nota={`${personas.total} ${personas.total === 1 ? "registro" : "registros"} persona × capacitación · ordenados por tiempo conectado`}
            />
            <FiltrosTrazabilidad
              areas={datos.areas.map((a) => ({ id: a.id, nombre: a.nombre }))}
              capacitaciones={capacitaciones.map((c) => ({ id: c.id, titulo: tituloLegible(c.titulo), areaId: c.areaId ?? "sin-area" }))}
              area={parametros.area}
              actividad={parametros.actividad}
              q={parametros.q}
            />
            <div className="traz-tabla-marco">
              <table className="traz-tabla">
                <thead>
                  <tr>
                    <th scope="col">Persona</th>
                    <th scope="col">Área · capacitación</th>
                    <th scope="col" className="text-right">Conexiones</th>
                    <th scope="col">Tiempo conectado</th>
                    <th scope="col" className="text-right">Primera</th>
                    <th scope="col" className="text-right">Última</th>
                  </tr>
                </thead>
                <tbody>
                  {personas.filas.length === 0 && (
                    <tr>
                      <td colSpan={6} className="traz-lista-vacia">
                        Nadie coincide con estos filtros en {etiquetaPeriodo.toLowerCase()}.
                      </td>
                    </tr>
                  )}
                  {personas.filas.map((f) => (
                    <tr key={f.clave} data-tono={tonoDeArea.get(f.areaId ?? "sin-area") ?? 0}>
                      <td data-col="Persona">
                        <span className="traz-persona">
                          <span className="traz-persona-nombre">{f.nombre}</span>
                          {f.externo && <span className="traz-externo">Externo</span>}
                        </span>
                      </td>
                      <td data-col="Área · capacitación">
                        <span className="traz-contexto">
                          <small>{f.area}</small>
                          <span>{tituloLegible(f.capacitacion)}</span>
                        </span>
                      </td>
                      <td data-col="Conexiones" className="text-right mono-dato">{f.conexiones}</td>
                      <td data-col="Tiempo conectado">
                        <span className="traz-duracion">
                          <span className="traz-duracion-riel" aria-hidden="true">
                            <span style={{ width: `${Math.max(2, Math.round((f.minutos / personas.minutosMaximo) * 100))}%` }} />
                          </span>
                          <b className="mono-dato">{duracion(f.minutos)}</b>
                        </span>
                      </td>
                      <td data-col="Primera" className="text-right mono-dato">{fechaHora(f.primeraConexion)}</td>
                      <td data-col="Última" className="text-right mono-dato">{fechaHora(f.ultimaConexion)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <TablePagination total={personas.total} page={personas.pagina} pageSize={personas.porPagina} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Cabecera({ id, Icono, titulo, nota, accion }: { id: string; Icono: typeof Building2; titulo: string; nota: string; accion?: React.ReactNode }) {
  return (
    <div className="traz-seccion">
      <span className="traz-seccion-sello" aria-hidden="true">
        <Icono className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <h2 id={id} className="traz-seccion-titulo">{titulo}</h2>
        <p className="traz-seccion-nota">{nota}</p>
      </div>
      <span className="traz-seccion-linea" aria-hidden="true" />
      {accion}
    </div>
  );
}

function FilaCapacitacion({ c, tono, i, href, trimestre }: { c: CapacitacionTrazada; tono: number; i: number; href: string; trimestre: number | null }) {
  const programados = new Set(c.quarters);
  const conDatos = new Map(c.porTrimestre.map((t) => [t.trimestre, t]));
  return (
    <article className="traz-fila revelar" data-tono={tono} style={escalon(i)}>
      <div className="traz-fila-nombre">
        <span className="traz-fila-riel" aria-hidden="true" />
        <div className="min-w-0">
          <p className="mono-label truncate">{c.areaNombre}</p>
          <h3 className="truncate" title={tituloLegible(c.titulo)}>{tituloLegible(c.titulo)}</h3>
        </div>
      </div>
      <div className="traz-fila-trimestres" aria-label="Trimestres">
        {[1, 2, 3, 4].map((t) => {
          const d = conDatos.get(t);
          return (
            <span
              key={t}
              className="traz-tri"
              data-programado={programados.has(t) || undefined}
              data-con-datos={d ? "" : undefined}
              data-elegido={trimestre === t || undefined}
              title={d ? `T${t}: ${d.personas} personas · ${duracion(d.minutos)}` : programados.has(t) ? `T${t}: programado, sin conexiones` : `T${t}: no programado`}
            >
              T{t}
              {d && <small>{d.personas}</small>}
            </span>
          );
        })}
      </div>
      <div className="traz-fila-dato" data-col="Jornadas">
        <b>{c.jornadas}</b>
      </div>
      <div className="traz-fila-dato" data-col="Personas">
        <b>{c.kpis.personas}</b>
        {c.kpis.externos > 0 && <small>{c.kpis.externos} ext.</small>}
      </div>
      <div className="traz-fila-dato" data-col="Permanencia">
        <b>{duracion(c.kpis.permanenciaPromedioMin)}</b>
        <small>med. {duracion(c.kpis.permanenciaMedianaMin)}</small>
      </div>
      <div className="traz-fila-dato" data-col="Minutos">
        <b>{duracion(c.kpis.minutos)}</b>
        <small>{c.kpis.tramos} tramos</small>
      </div>
      <div className="traz-fila-dato" data-col="Audiencia">
        {c.porcentajeConectados === null ? (
          <b className="text-muted-foreground">—</b>
        ) : (
          <>
            <b>{c.porcentajeConectados} %</b>
            <small>{c.kpis.personasInternas} de {c.audiencia}</small>
            <span className="traz-medidor" aria-hidden="true">
              <span style={{ width: `${c.porcentajeConectados}%` }} />
            </span>
          </>
        )}
      </div>
      <Link href={href} className="traz-fila-ir" aria-label={`Abrir ${tituloLegible(c.titulo)}`}>
        <CalendarRange className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Abrir</span>
        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
    </article>
  );
}
