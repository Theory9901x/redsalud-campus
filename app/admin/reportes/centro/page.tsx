import { Activity, Award, BadgeCheck, LogIn, MapPin, Percent, UserX, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { AutoFilterSelect, AutoSearchInput } from "@/components/admin/auto-search-input";
import { TablePagination } from "@/components/admin/table-pagination";
import { parsePageSize } from "@/lib/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ENROLLMENT_STATUS_LABELS } from "@/components/cursos/labels";
import { DashboardPanel } from "@/components/dashboard/dashboard-kit";
import { EmptyState } from "@/components/brand/empty-state";
import {
  AreaActividad,
  BarrasConteo,
  BarrasCumplimiento,
  Cohortes,
  DonaGrupos,
  LineaMensual,
  Sparkline,
} from "@/components/reportes/panel-graficos";
import { CentroVistas } from "@/components/reportes/centro-vistas";
import { BotonInforme } from "@/components/reportes/boton-informe";
import {
  actividadEnTiempo,
  adopcion,
  avancePorCurso,
  certificadosPor,
  cohortesInscripcion,
  cumplimientoPor,
  detalleInscripciones,
  kpis,
  metricasPlanta,
  serieMensual,
  type FiltrosReporte,
} from "@/lib/reportes";
import { PERSONNEL_TYPE_LABELS } from "@/lib/personnel-labels";

const VINCULACION_LABELS: Record<string, string> = {
  CARRERA_ADMINISTRATIVA: "Carrera administrativa",
  PROVISIONALIDAD: "Provisionalidad",
  TEMPORAL: "Temporal",
  TRABAJADOR_OFICIAL: "Trabajador oficial",
  LIBRE_NOMBRAMIENTO: "Libre nombramiento",
  PERIODO_FIJO: "Periodo fijo",
  CONTRATO_PRESTACION: "Contrato de prestación",
  OTRO: "Otro",
};

/**
 * CENTRO DE DATOS: analítica del aprendizaje en un solo lugar, con
 * modalidades de vista (resumen, tendencias, territorio, cursos, detalle).
 * Los agregados y series salen de la base en consultas únicas; el detalle
 * por persona vive en su propia pestaña -es soporte, no protagonista-.
 */
export default async function CentroDatosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const porPagina = parsePageSize(sp.pageSize);
  const pagina = Math.max(1, Number(sp.page) || 1);
  const filtros: FiltrosReporte = {
    desde: sp.desde,
    hasta: sp.hasta,
    municipioId: sp.municipio,
    grupo: sp.grupo,
    cargoId: sp.cargo,
    vinculacion: sp.vinculacion,
    cursoId: sp.curso,
    modalidad: sp.modalidad,
  };

  // Una consulta agregada por panel; todas en paralelo.
  const [
    k,
    serie,
    acceso,
    cohortes,
    porCurso,
    porMunicipio,
    porCargo,
    porGrupo,
    certPorMunicipio,
    certPorCurso,
    planta,
    actividad,
    detalle,
    municipios,
    cargos,
    cursosOpciones,
  ] = await Promise.all([
    kpis(filtros),
    serieMensual(filtros),
    adopcion(filtros),
    cohortesInscripcion(filtros),
    avancePorCurso(filtros),
    cumplimientoPor("municipio", filtros),
    cumplimientoPor("cargo", filtros),
    cumplimientoPor("grupo", filtros),
    certificadosPor("municipio", filtros),
    certificadosPor("curso", filtros),
    metricasPlanta(filtros),
    actividadEnTiempo(filtros),
    detalleInscripciones(filtros, { busqueda: sp.q, pagina, porPagina }),
    prisma.municipio.findMany({ where: { isActive: true }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
    prisma.cargo.findMany({ where: { isActive: true }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
    prisma.course.findMany({ orderBy: { title: "asc" }, select: { id: true, title: true } }),
  ]);

  const ingresaron = acceso.totalActivos - acceso.nuncaIngresaron;
  const adopcionPct = acceso.totalActivos > 0 ? Math.round((ingresaron / acceso.totalActivos) * 100) : 0;
  const serieCorta = serie.slice(-6).map((m) => ({ ...m }));
  const grupos = porGrupo.map((g) => ({
    etiqueta: PERSONNEL_TYPE_LABELS[g.etiqueta as "ASISTENCIAL"] ?? g.etiqueta,
    personas: g.personas,
    completaron: g.completaron,
  }));
  const totalPlanta = planta.reduce((s, p) => s + p.personas, 0);
  const plantaCompletaron = planta.reduce((s, p) => s + p.completaron, 0);

  const KPIS: {
    etiqueta: string;
    valor: string;
    detalle: string;
    icon: typeof Users;
    spark?: string;
    tono?: "alerta";
  }[] = [
    { etiqueta: "Personas activas", valor: String(k.personas), detalle: "con formación asignada", icon: Users },
    { etiqueta: "Inscripciones", valor: String(k.inscritos), detalle: "en todos los cursos", icon: BadgeCheck, spark: "inscripciones" },
    { etiqueta: "Cumplimiento", valor: `${k.cumplimiento}%`, detalle: `${k.completaron} completadas`, icon: Percent, spark: "completadas" },
    { etiqueta: "Certificados", valor: String(k.certificados), detalle: "emitidos", icon: Award, spark: "certificados" },
    { etiqueta: "Adopción", valor: `${adopcionPct}%`, detalle: `${ingresaron} ya ingresaron`, icon: LogIn },
    {
      etiqueta: "Nunca ingresaron",
      valor: String(acceso.nuncaIngresaron),
      detalle: "necesitan que les llegue el acceso",
      icon: UserX,
      tono: "alerta",
    },
  ];

  return (
    <div className="accent-admin space-y-6">
      {/* ---- Hero ---- */}
      <header className="hud-hero hud-grid relative p-6 sm:p-7">
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-white/70">
              <Activity className="h-3.5 w-3.5 text-[var(--accent)]" aria-hidden="true" />
              Analítica del aprendizaje
            </p>
            <h1 className="mt-1.5 font-display text-[clamp(1.6rem,3vw,2.1rem)] font-extrabold tracking-tight text-white">
              Centro de datos
            </h1>
            <p className="mt-1 max-w-xl text-[13.5px] leading-relaxed text-white/70">
              Cumplimiento, tendencias, territorio y cursos en un solo tablero. Lo que filtres aquí es lo que sale
              en el informe PDF.
            </p>
          </div>
          <BotonInforme />
        </div>
      </header>

      {/* ---- Filtros globales ---- */}
      <div className="surface-lumen flex flex-wrap items-end gap-3 p-4">
        <AutoSearchInput label="Buscar persona o curso" placeholder="Nombre, cédula o curso..." />
        <AutoFilterSelect
          paramName="municipio"
          label="Municipio"
          options={municipios.map((m) => ({ value: m.id, label: m.nombre }))}
        />
        <AutoFilterSelect
          paramName="grupo"
          label="Grupo poblacional"
          options={Object.entries(PERSONNEL_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <AutoFilterSelect
          paramName="cargo"
          label="Cargo"
          options={cargos.map((c) => ({ value: c.id, label: c.nombre }))}
        />
        <AutoFilterSelect
          paramName="vinculacion"
          label="Vinculación"
          options={Object.entries(VINCULACION_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <AutoFilterSelect
          paramName="curso"
          label="Curso"
          options={cursosOpciones.map((c) => ({ value: c.id, label: c.title }))}
        />
        <AutoFilterSelect
          paramName="modalidad"
          label="Modalidad"
          options={[
            { value: "VIRTUAL", label: "Virtual" },
            { value: "PRESENCIAL", label: "Presencial" },
            { value: "MIXTA", label: "Mixta" },
          ]}
        />
      </div>

      {/* ---- KPIs con tendencia ---- */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {KPIS.map((kpi) => (
          <div key={kpi.etiqueta} className={kpi.tono === "alerta" ? "surface-vivo glow-alerta" : "surface-vivo"}>
            <div className="flex h-full flex-col p-4">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={
                    kpi.tono === "alerta"
                      ? "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-warning/18 text-warning-foreground"
                      : "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_oklch,var(--accent)_14%,transparent)] text-[var(--accent)]"
                  }
                >
                  <kpi.icon className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                </span>
              </div>
              <p className="mt-2.5 font-display text-[1.55rem] font-extrabold leading-none tracking-tight tabular-nums text-foreground">
                {kpi.valor}
              </p>
              <p className="mt-1 text-[11.5px] font-semibold text-foreground/80">{kpi.etiqueta}</p>
              <p className="text-[10.5px] leading-tight text-muted-foreground">{kpi.detalle}</p>
              {kpi.spark && (
                <div className="mt-auto pt-2">
                  <Sparkline
                    datos={serieCorta}
                    dataKey={kpi.spark}
                    color={kpi.spark === "completadas" ? "var(--success)" : kpi.spark === "certificados" ? "var(--warning)" : "var(--primary)"}
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ---- Vistas ---- */}
      <CentroVistas
        resumen={
          <>
            <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              <DashboardPanel title="Evolución mensual" description="Inscripciones, finalizaciones y certificados de los últimos 12 meses.">
                <LineaMensual datos={serie} />
              </DashboardPanel>
              <DashboardPanel title="Distribución del personal" description="Personas inscritas por grupo poblacional.">
                {grupos.length === 0 ? (
                  <EmptyState icon={Users} title="Sin datos para estos filtros" className="py-10" />
                ) : (
                  <DonaGrupos datos={grupos} />
                )}
              </DashboardPanel>
            </div>
            <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
              <DashboardPanel title="Cumplimiento por grupo poblacional" description="Asistencial frente a administrativo.">
                {grupos.length === 0 ? (
                  <EmptyState icon={Users} title="Sin datos para estos filtros" className="py-10" />
                ) : (
                  <BarrasCumplimiento datos={grupos} />
                )}
              </DashboardPanel>
              <DashboardPanel title="Cohortes de inscripción" description="De lo inscrito cada mes, cuánto está terminado hoy.">
                <Cohortes datos={cohortes} />
              </DashboardPanel>
            </div>
            <DashboardPanel
              title="Personal de planta"
              description={`${totalPlanta} personas de planta · cumplimiento ${totalPlanta > 0 ? Math.round((plantaCompletaron / totalPlanta) * 100) : 0}%`}
            >
              {totalPlanta === 0 ? (
                <EmptyState icon={Users} title="Sin personal de planta con estos filtros" className="py-10" />
              ) : (
                <BarrasCumplimiento
                  datos={planta.map((p) => ({
                    etiqueta: PERSONNEL_TYPE_LABELS[p.grupo as "ASISTENCIAL"] ?? p.grupo,
                    personas: p.personas,
                    completaron: p.completaron,
                  }))}
                />
              )}
            </DashboardPanel>
          </>
        }
        tendencias={
          <>
            <DashboardPanel title="Evolución mensual" description="Los últimos 12 meses, mes a mes.">
              <LineaMensual datos={serie} alto={320} />
            </DashboardPanel>
            <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
              <DashboardPanel title="Actividad diaria" description="Inscripciones y certificados por día en el rango filtrado.">
                <AreaActividad datos={actividad} />
              </DashboardPanel>
              <DashboardPanel title="Cohortes de inscripción" description="Retención real: de cada camada mensual, cuánto ya terminó.">
                <Cohortes datos={cohortes} />
              </DashboardPanel>
            </div>
          </>
        }
        territorio={
          <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
            <DashboardPanel title="Cumplimiento por municipio" description="Porcentaje que completó la formación en la que está inscrito.">
              {porMunicipio.length === 0 ? (
                <EmptyState icon={MapPin} title="Sin datos para estos filtros" className="py-10" />
              ) : (
                <BarrasCumplimiento datos={porMunicipio} maximo={14} />
              )}
            </DashboardPanel>
            <DashboardPanel title="Certificados por municipio">
              {certPorMunicipio.length === 0 ? (
                <EmptyState icon={Award} title="Todavía no hay certificados emitidos" className="py-10" />
              ) : (
                <BarrasConteo datos={certPorMunicipio} etiquetaSerie="Certificados" />
              )}
            </DashboardPanel>
          </div>
        }
        cursos={
          <>
            <DashboardPanel title="Avance por curso" description="Inscritos frente a completados en los cursos con más gente.">
              {porCurso.length === 0 ? (
                <EmptyState icon={Award} title="Sin inscripciones con estos filtros" className="py-10" />
              ) : (
                <BarrasCumplimiento datos={porCurso} maximo={14} />
              )}
            </DashboardPanel>
            <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
              <DashboardPanel title="Certificados por curso">
                {certPorCurso.length === 0 ? (
                  <EmptyState icon={Award} title="Todavía no hay certificados emitidos" className="py-10" />
                ) : (
                  <BarrasConteo datos={certPorCurso} etiquetaSerie="Certificados" />
                )}
              </DashboardPanel>
              <DashboardPanel title="Cumplimiento por cargo" description="Qué tipo de profesional está cumpliendo.">
                {porCargo.length === 0 ? (
                  <EmptyState icon={Users} title="Sin datos para estos filtros" className="py-10" />
                ) : (
                  <BarrasCumplimiento datos={porCargo} />
                )}
              </DashboardPanel>
            </div>
          </>
        }
        detalle={
          <DashboardPanel
            title="Detalle por persona y curso"
            description="⭐ marca al personal de planta. Responde a los mismos filtros y al buscador."
          >
            <div className="-mx-5 -mb-5 overflow-hidden rounded-b-[var(--radius-surface)]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Persona</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead>Municipio</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Grupo</TableHead>
                    <TableHead>Vinculación</TableHead>
                    <TableHead>Curso</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Avance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detalle.filas.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                        No hay registros con estos filtros.
                      </TableCell>
                    </TableRow>
                  )}
                  {detalle.filas.map((f) => (
                    <TableRow key={f.enrollmentId}>
                      <TableCell className="max-w-[220px] truncate font-medium text-foreground">
                        {f.esPlanta && <span title="Personal de planta">⭐ </span>}
                        {f.persona}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{f.documento}</TableCell>
                      <TableCell className="text-muted-foreground">{f.municipio ?? "—"}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-muted-foreground" title={f.cargo ?? ""}>
                        {f.cargo ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {PERSONNEL_TYPE_LABELS[f.grupo as "ASISTENCIAL"] ?? f.grupo}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {VINCULACION_LABELS[f.vinculacion] ?? f.vinculacion}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-muted-foreground" title={f.curso}>
                        {f.curso}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            f.estado === "COMPLETED"
                              ? "bg-success/15 text-success"
                              : f.estado === "FAILED"
                                ? "bg-destructive/10 text-destructive"
                                : "bg-primary/10 text-primary"
                          }
                        >
                          {ENROLLMENT_STATUS_LABELS[f.estado as "ACTIVE"] ?? f.estado}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">{f.avance}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePagination total={detalle.total} page={pagina} pageSize={porPagina} />
            </div>
          </DashboardPanel>
        }
      />
    </div>
  );
}
