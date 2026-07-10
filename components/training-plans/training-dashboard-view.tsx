import Link from "next/link";
import {
  ClipboardCheck,
  CalendarRange,
  Building2,
  TrendingUp,
  ClipboardList,
  Download,
  Gauge,
  Users2,
} from "lucide-react";
import { MetricCard } from "@/components/admin/metric-card";
import { StaggerGrid } from "@/components/brand/stagger-grid";
import { EmptyState } from "@/components/brand/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AdherenceBarChart } from "@/components/training-plans/adherence-bar-chart";
import { PlanMetricsView } from "@/components/training-plans/plan-metrics-view";
import { TRAINING_PLAN_STATUS_LABELS, TRAINING_PLAN_STATUS_CLASSES } from "@/components/training-plans/labels";
import type { TrainingDashboardData } from "@/lib/training-dashboard";
import type { AdherenceBarDatum } from "@/components/training-plans/adherence-bar-chart";
import type { ActivityStatusDatum } from "@/components/training-plans/activity-status-pie-chart";

export type SelectedPlanMetrics = {
  planId: string;
  overallPercentage: number | null;
  adherenceBarData: AdherenceBarDatum[];
  statusPieData: ActivityStatusDatum[];
  surveyResponseRate: number | null;
  totalActivities: number;
  totalSurveys: number;
};

export function TrainingDashboardView({
  data,
  basePath,
  activeTab,
  selectedPlanId,
  selectedPlanMetrics,
}: {
  data: TrainingDashboardData;
  basePath: string;
  activeTab: string;
  selectedPlanId: string | null;
  selectedPlanMetrics: SelectedPlanMetrics | null;
}) {
  return (
    <Tabs defaultValue={activeTab}>
      <TabsList>
        <TabsTrigger value="total">Total</TabsTrigger>
        <TabsTrigger value="por-plan">Por plan</TabsTrigger>
        <TabsTrigger value="por-personal">Por personal</TabsTrigger>
      </TabsList>

      <TabsContent value="total" className="space-y-6 pt-4">
        <StaggerGrid className="grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Planes" value={data.totalPlans} icon={CalendarRange} accent="primary" />
          <MetricCard label="Actividades" value={data.totalActivities} icon={ClipboardList} accent="warning" />
          <MetricCard
            label="Cumplimiento global"
            value={data.globalCompliance ?? 0}
            suffix="%"
            icon={ClipboardCheck}
            accent="success"
          />
          <MetricCard
            label="Tasa de respuesta a encuestas"
            value={data.overallResponseRate ?? 0}
            suffix="%"
            icon={Gauge}
            accent="destructive"
          />
        </StaggerGrid>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="surface space-y-4 p-6">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
                Adherencia por dependencia
              </h2>
            </div>
            {data.departmentBreakdown.length === 0 ? (
              <EmptyState
                icon={Building2}
                title="Sin datos todavía"
                description="Aparecerá cuando haya actividades con audiencia objetivo real."
                className="py-10"
              />
            ) : (
              <AdherenceBarChart
                data={data.departmentBreakdown.map((row) => ({ label: row.department, percentage: row.averagePercentage }))}
              />
            )}
          </section>

          <section className="surface space-y-4 p-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
                Evolución del cumplimiento en el tiempo
              </h2>
            </div>
            {data.evolution.length === 0 ? (
              <EmptyState
                icon={TrendingUp}
                title="Sin datos todavía"
                description="Aparecerá a medida que las actividades avancen en el calendario."
                className="py-10"
              />
            ) : (
              <AdherenceBarChart data={data.evolution.map((row) => ({ label: row.label, percentage: row.averagePercentage }))} />
            )}
          </section>
        </div>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg font-bold text-foreground">Planes y su cumplimiento</h2>
            <a
              href="/api/reportes/planes-cumplimiento"
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              <Download className="h-4 w-4" />
              Exportar CSV
            </a>
          </div>
          <div className="surface overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plan</TableHead>
                  <TableHead>Dependencia</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-center">Actividades</TableHead>
                  <TableHead className="text-center">Cumplimiento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.planRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      Sin planes todavía.
                    </TableCell>
                  </TableRow>
                )}
                {data.planRows.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell>
                      <Link href={`${basePath}/${plan.id}`} className="font-medium text-foreground hover:underline">
                        {plan.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">{plan.year}</p>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{plan.targetDepartment ?? "Todo el personal"}</TableCell>
                    <TableCell>
                      <Badge className={TRAINING_PLAN_STATUS_CLASSES[plan.status]}>
                        {TRAINING_PLAN_STATUS_LABELS[plan.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">{plan.activityCount}</TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      {plan.overallPercentage !== null ? `${plan.overallPercentage}%` : "Sin datos"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg font-bold text-foreground">Resultados de encuestas</h2>
            <a
              href="/api/reportes/planes-encuestas"
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              <Download className="h-4 w-4" />
              Exportar CSV
            </a>
          </div>
          <div className="surface overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Encuesta</TableHead>
                  <TableHead>Alcance</TableHead>
                  <TableHead className="text-center">Respondieron</TableHead>
                  <TableHead className="text-center">Tasa de respuesta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.surveyRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                      Sin encuestas todavía.
                    </TableCell>
                  </TableRow>
                )}
                {data.surveyRows.map((survey) => (
                  <TableRow key={survey.id}>
                    <TableCell>
                      <Link
                        href={`${basePath}/${survey.planId}/encuestas/${survey.id}`}
                        className="font-medium text-foreground hover:underline"
                      >
                        {survey.title}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{survey.scope}</TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      {survey.respondedCount} de {survey.targetCount}
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">{survey.responseRate}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      </TabsContent>

      <TabsContent value="por-plan" className="space-y-4 pt-4">
        <form method="get" className="surface flex flex-wrap items-end gap-3 p-4">
          <input type="hidden" name="tab" value="por-plan" />
          <div className="flex-1 min-w-[240px] space-y-1.5">
            <label htmlFor="plan" className="text-xs font-medium text-muted-foreground">
              Selecciona un plan
            </label>
            <select
              id="plan"
              name="plan"
              defaultValue={selectedPlanId ?? ""}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Selecciona...</option>
              {data.planRows.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.title}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Ver métricas
          </button>
        </form>

        {selectedPlanMetrics ? (
          <PlanMetricsView
            planId={selectedPlanMetrics.planId}
            overallPercentage={selectedPlanMetrics.overallPercentage}
            adherenceBarData={selectedPlanMetrics.adherenceBarData}
            statusPieData={selectedPlanMetrics.statusPieData}
            surveyResponseRate={selectedPlanMetrics.surveyResponseRate}
            totalActivities={selectedPlanMetrics.totalActivities}
            totalSurveys={selectedPlanMetrics.totalSurveys}
          />
        ) : (
          <EmptyState
            icon={CalendarRange}
            title="Elige un plan"
            description="Selecciona un plan arriba para ver sus métricas, igual que en su propia página."
          />
        )}
      </TabsContent>

      <TabsContent value="por-personal" className="space-y-6 pt-4">
        <StaggerGrid className="grid-cols-1 gap-4 sm:grid-cols-2">
          {data.personnelTypeBreakdown.map((row) => (
            <MetricCard
              key={row.personnelType}
              label={`Adherencia · ${row.label}`}
              value={row.averagePercentage ?? 0}
              suffix="%"
              icon={Users2}
              accent={row.personnelType === "ADMINISTRATIVO" ? "primary" : "success"}
            />
          ))}
        </StaggerGrid>

        <section className="surface space-y-4 p-6">
          <div className="flex items-center gap-2">
            <Users2 className="h-4 w-4 text-primary" />
            <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
              Adherencia por tipo de personal
            </h2>
          </div>
          {data.personnelTypeBreakdown.every((row) => row.activityCount === 0) ? (
            <EmptyState
              icon={Users2}
              title="Sin datos todavía"
              description="Aparecerá cuando haya actividades con audiencia objetivo real por tipo de personal."
              className="py-10"
            />
          ) : (
            <AdherenceBarChart
              data={data.personnelTypeBreakdown
                .filter((row) => row.averagePercentage !== null)
                .map((row) => ({ label: row.label, percentage: row.averagePercentage! }))}
            />
          )}
        </section>
      </TabsContent>
    </Tabs>
  );
}
