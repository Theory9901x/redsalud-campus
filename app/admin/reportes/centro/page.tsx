import { Award, BadgeCheck, MapPin, Percent, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AutoFilterSelect, AutoSearchInput } from "@/components/admin/auto-search-input";
import { TablePagination } from "@/components/admin/table-pagination";
import { parsePageSize } from "@/lib/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ENROLLMENT_STATUS_LABELS } from "@/components/cursos/labels";
import { KpiCard, DashboardPanel } from "@/components/dashboard/dashboard-kit";
import { EmptyState } from "@/components/brand/empty-state";
import { BarrasCumplimiento, BarrasConteo, AreaActividad } from "@/components/reportes/panel-graficos";
import { BotonInforme } from "@/components/reportes/boton-informe";
import {
  actividadEnTiempo,
  detalleInscripciones,
  certificadosPor,
  cumplimientoPor,
  kpis,
  metricasPlanta,
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
  };

  // Una consulta agregada por panel; todas en paralelo.
  const [
    k,
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
    cursos,
  ] = await Promise.all([
    kpis(filtros),
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

  const totalPlanta = planta.reduce((s, p) => s + p.personas, 0);
  const plantaCompletaron = planta.reduce((s, p) => s + p.completaron, 0);

  return (
    <div className="accent-admin space-y-6">
      <AdminPageHeader
        title="Centro de datos"
        description="Cumplimiento, certificados y personal de planta. Todo lo que filtres aquí es lo que sale en el informe."
        action={<BotonInforme />}
      />

      {/* Filtros globales: aplican a todos los paneles. */}
      <div className="surface-panel flex flex-wrap items-end gap-3 p-4">
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
          options={cursos.map((c) => ({ value: c.id, label: c.title }))}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <KpiCard label="Personas" value={k.personas} icon={Users} />
        <KpiCard label="Inscritas" value={k.inscritos} icon={BadgeCheck} />
        <KpiCard label="Completaron" value={k.completaron} icon={Percent} />
        <KpiCard label="Cumplimiento" value={`${k.cumplimiento}%`} icon={Percent} />
        <KpiCard label="Certificados" value={k.certificados} icon={Award} />
      </div>

      {/* A. Cumplimiento */}
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
        <DashboardPanel title="Cumplimiento por municipio" description="Porcentaje de personas que completaron obligatorios.">
          {porMunicipio.length === 0 ? (
            <EmptyState icon={MapPin} title="Sin datos para estos filtros" className="py-10" />
          ) : (
            <BarrasCumplimiento datos={porMunicipio} />
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

      <DashboardPanel title="Cumplimiento por grupo poblacional" description="Asistencial frente a administrativo.">
        {porGrupo.length === 0 ? (
          <EmptyState icon={Users} title="Sin datos para estos filtros" className="py-10" />
        ) : (
          <BarrasCumplimiento
            datos={porGrupo.map((g) => ({ ...g, etiqueta: PERSONNEL_TYPE_LABELS[g.etiqueta as "ASISTENCIAL"] ?? g.etiqueta }))}
          />
        )}
      </DashboardPanel>

      {/* B. Certificados */}
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
        <DashboardPanel title="Certificados por municipio">
          {certPorMunicipio.length === 0 ? (
            <EmptyState icon={Award} title="Todavía no hay certificados emitidos" className="py-10" />
          ) : (
            <BarrasConteo datos={certPorMunicipio} etiquetaSerie="Certificados" />
          )}
        </DashboardPanel>
        <DashboardPanel title="Certificados por curso">
          {certPorCurso.length === 0 ? (
            <EmptyState icon={Award} title="Todavía no hay certificados emitidos" className="py-10" />
          ) : (
            <BarrasConteo datos={certPorCurso} etiquetaSerie="Certificados" />
          )}
        </DashboardPanel>
      </div>

      {/* D. Personal de planta */}
      <DashboardPanel
        title="Personal de planta"
        description="Todo el que no es contratista. Usa el filtro de grupo para ver solo asistenciales o solo administrativos."
      >
        {totalPlanta === 0 ? (
          <EmptyState icon={Users} title="Sin personal de planta con estos filtros" className="py-10" />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <KpiCard label="Total de planta" value={totalPlanta} icon={Users} />
              <KpiCard
                label="Cumplimiento de planta"
                value={`${totalPlanta > 0 ? Math.round((plantaCompletaron / totalPlanta) * 100) : 0}%`}
                icon={Percent}
              />
              {planta.map((p) => (
                <KpiCard
                  key={p.grupo}
                  label={PERSONNEL_TYPE_LABELS[p.grupo as "ASISTENCIAL"] ?? p.grupo}
                  value={p.personas}
                  icon={Users}
                />
              ))}
            </div>
            <BarrasCumplimiento
              datos={planta.map((p) => ({
                etiqueta: PERSONNEL_TYPE_LABELS[p.grupo as "ASISTENCIAL"] ?? p.grupo,
                personas: p.personas,
                completaron: p.completaron,
              }))}
            />
          </div>
        )}
      </DashboardPanel>

      {/* 8.5 Tabla de detalle: mismas dimensiones que los paneles, paginada en servidor. */}
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

      {/* E. Actividad */}
      <DashboardPanel title="Actividad en el tiempo" description="Inscripciones y certificados por día.">
        <AreaActividad datos={actividad} />
      </DashboardPanel>
    </div>
  );
}
