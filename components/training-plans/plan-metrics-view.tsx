import { ClipboardCheck, Gauge, CalendarRange, ClipboardList, BarChart3, PieChart } from "lucide-react";
import { MetricCard } from "@/components/admin/metric-card";
import { StaggerGrid } from "@/components/brand/stagger-grid";
import { EmptyState } from "@/components/brand/empty-state";
import { AdherenceBarChart, type AdherenceBarDatum } from "@/components/training-plans/adherence-bar-chart";
import { ActivityStatusPieChart, type ActivityStatusDatum } from "@/components/training-plans/activity-status-pie-chart";
import { PlanReportExportDialog } from "@/components/training-plans/plan-report-export-dialog";

export function PlanMetricsView({
  planId,
  overallPercentage,
  adherenceBarData,
  statusPieData,
  surveyResponseRate,
  totalActivities,
  totalSurveys,
}: {
  planId: string;
  overallPercentage: number | null;
  adherenceBarData: AdherenceBarDatum[];
  statusPieData: ActivityStatusDatum[];
  surveyResponseRate: number | null;
  totalActivities: number;
  totalSurveys: number;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StaggerGrid className="grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 flex-1">
          <MetricCard label="Actividades" value={totalActivities} icon={CalendarRange} accent="primary" />
          <MetricCard label="Encuestas" value={totalSurveys} icon={ClipboardList} accent="warning" />
          <MetricCard
            label="Cumplimiento global"
            value={overallPercentage ?? 0}
            suffix="%"
            icon={ClipboardCheck}
            accent="success"
          />
          <MetricCard
            label="Tasa de respuesta a encuestas"
            value={surveyResponseRate ?? 0}
            suffix="%"
            icon={Gauge}
            accent="destructive"
          />
        </StaggerGrid>
      </div>

      <div className="flex justify-end">
        <PlanReportExportDialog planId={planId} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="surface space-y-4 p-6">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
              Adherencia por actividad
            </h2>
          </div>
          {adherenceBarData.length === 0 ? (
            <EmptyState
              icon={BarChart3}
              title="Sin datos todavía"
              description="Aparecerá cuando haya actividades con audiencia objetivo real."
              className="py-10"
            />
          ) : (
            <AdherenceBarChart data={adherenceBarData} />
          )}
        </section>

        <section className="surface space-y-4 p-6">
          <div className="flex items-center gap-2">
            <PieChart className="h-4 w-4 text-primary" />
            <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
              Actividades por estado
            </h2>
          </div>
          <ActivityStatusPieChart data={statusPieData} />
        </section>
      </div>
    </div>
  );
}
