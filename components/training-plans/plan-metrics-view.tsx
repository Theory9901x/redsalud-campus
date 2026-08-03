import { ClipboardCheck, Gauge, CalendarRange, BarChart3, Layers, PlayCircle, GitCompareArrows } from "lucide-react";
import { MetricCard } from "@/components/admin/metric-card";
import { StaggerGrid } from "@/components/brand/stagger-grid";
import { EmptyState } from "@/components/brand/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AdherenceBarChart } from "@/components/training-plans/adherence-bar-chart";
import { AreaStatusChart } from "@/components/training-plans/area-status-chart";
import { PrePostChart } from "@/components/training-plans/pre-post-chart";
import { PlanReportExportDialog } from "@/components/training-plans/plan-report-export-dialog";
import { SEMAFORO_CLASSES, nivelSemaforo } from "@/components/training-plans/labels";
import type { PlanMetricsData } from "@/lib/plan-metrics";

/**
 * Métricas del plan en el eje en el que se toman decisiones: el ÁREA.
 *
 * Nada de una barra por cada una de las 55 actividades ni de una dona con
 * 54 borradores: cobertura y estado por área (8 filas legibles), el
 * comparativo presaber/postsaber donde existe, y una tabla ejecutiva que se
 * puede leer en una reunión. Cada gráfica solo aparece cuando tiene algo
 * que decir; en su lugar, el vacío explica qué la va a llenar.
 */
export function PlanMetricsView({ data }: { data: PlanMetricsData }) {
  const { kpis, porArea, ciclos } = data;
  const hayAdherencia = porArea.some((a) => a.adherencia !== null && a.adherencia > 0);
  const nivelCumplimiento = nivelSemaforo(kpis.cumplimiento);
  const nivelCobertura = nivelSemaforo(kpis.cobertura);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <StaggerGrid className="grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5 flex-1">
          <MetricCard label="Capacitaciones" value={kpis.totalActividades} icon={CalendarRange} accent="primary" />
          <MetricCard
            label={`Cobertura de contenido (${kpis.conContenido} de ${kpis.totalActividades})`}
            value={kpis.cobertura ?? 0}
            suffix="%"
            icon={Layers}
            accent={nivelCobertura === "muted" ? "primary" : nivelCobertura}
          />
          <MetricCard label="Jornadas abiertas" value={kpis.jornadasAbiertas} icon={PlayCircle} accent="warning" />
          <MetricCard
            label="Cumplimiento global"
            value={kpis.cumplimiento ?? 0}
            suffix="%"
            icon={ClipboardCheck}
            accent={nivelCumplimiento === "muted" ? "primary" : nivelCumplimiento}
          />
          <MetricCard
            label={`Respuesta a encuestas (${kpis.encuestas})`}
            value={kpis.tasaEncuestas ?? 0}
            suffix="%"
            icon={Gauge}
            accent="destructive"
          />
        </StaggerGrid>
        <PlanReportExportDialog planId={data.planId} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="surface space-y-4 p-6">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
              Cobertura de contenido por área
            </h2>
          </div>
          <AdherenceBarChart data={porArea.map((a) => ({ label: a.name, percentage: a.cobertura ?? 0 }))} />
        </section>

        <section className="surface space-y-4 p-6">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
              Estado de las jornadas por área
            </h2>
          </div>
          <AreaStatusChart data={porArea.map((a) => ({ name: a.name, draft: a.draft, open: a.open, closed: a.closed }))} />
        </section>
      </div>

      <section className="surface space-y-4 p-6">
        <div className="flex items-center gap-2">
          <GitCompareArrows className="h-4 w-4 text-primary" />
          <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
            Presaber vs. postsaber
          </h2>
        </div>
        {ciclos.length === 0 ? (
          <EmptyState
            icon={GitCompareArrows}
            title="Todavía nadie presenta el ciclo"
            description="Cuando un área habilite su presaber y el personal lo presente, aquí aparece el antes y el después de cada capacitación."
            className="py-10"
          />
        ) : (
          <PrePostChart data={ciclos.map((c) => ({ titulo: c.titulo, pre: c.pre, post: c.post }))} />
        )}
      </section>

      {hayAdherencia && (
        <section className="surface space-y-4 p-6">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-primary" />
            <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
              Adherencia por área
            </h2>
          </div>
          <AdherenceBarChart
            data={porArea.filter((a) => a.adherencia !== null).map((a) => ({ label: a.name, percentage: a.adherencia! }))}
          />
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold text-foreground">Resumen ejecutivo por área</h2>
        <div className="surface-panel overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Área</TableHead>
                <TableHead className="text-center">Capacitaciones</TableHead>
                <TableHead className="text-center">Con contenido</TableHead>
                <TableHead className="text-center">Cobertura</TableHead>
                <TableHead className="text-center">Abiertas</TableHead>
                <TableHead className="text-center">Cerradas</TableHead>
                <TableHead className="text-center">Adherencia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {porArea.map((a) => (
                <TableRow key={a.name}>
                  <TableCell className="font-medium text-foreground">{a.name}</TableCell>
                  <TableCell className="text-center text-muted-foreground">{a.total}</TableCell>
                  <TableCell className="text-center text-muted-foreground">{a.conContenido}</TableCell>
                  <TableCell className="text-center">
                    <Badge className={SEMAFORO_CLASSES[nivelSemaforo(a.cobertura)]}>
                      {a.cobertura !== null ? `${a.cobertura}%` : "—"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center text-muted-foreground">{a.open}</TableCell>
                  <TableCell className="text-center text-muted-foreground">{a.closed}</TableCell>
                  <TableCell className="text-center">
                    {a.adherencia !== null ? (
                      <Badge className={SEMAFORO_CLASSES[nivelSemaforo(a.adherencia)]}>{a.adherencia}%</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sin datos</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
