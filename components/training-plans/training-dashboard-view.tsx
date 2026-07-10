import Link from "next/link";
import {
  ClipboardCheck,
  CalendarRange,
  Building2,
  TrendingUp,
  ClipboardList,
  Download,
  Gauge,
} from "lucide-react";
import { MetricCard } from "@/components/admin/metric-card";
import { StaggerGrid } from "@/components/brand/stagger-grid";
import { EmptyState } from "@/components/brand/empty-state";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TRAINING_PLAN_STATUS_LABELS, TRAINING_PLAN_STATUS_CLASSES } from "@/components/training-plans/labels";
import { Badge } from "@/components/ui/badge";
import type { TrainingDashboardData } from "@/lib/training-dashboard";

export function TrainingDashboardView({ data, basePath }: { data: TrainingDashboardData; basePath: string }) {
  return (
    <div className="space-y-6">
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
            />
          ) : (
            <div className="space-y-3">
              {data.departmentBreakdown.map((row) => (
                <div key={row.department} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{row.department}</span>
                    <span className="text-muted-foreground">
                      {row.averagePercentage}% · {row.activityCount} {row.activityCount === 1 ? "actividad" : "actividades"}
                    </span>
                  </div>
                  <Progress value={row.averagePercentage} />
                </div>
              ))}
            </div>
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
            />
          ) : (
            <div className="space-y-3">
              {data.evolution.map((row) => (
                <div key={row.key} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{row.label}</span>
                    <span className="text-muted-foreground">{row.averagePercentage}%</span>
                  </div>
                  <Progress value={row.averagePercentage} />
                </div>
              ))}
            </div>
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
                  <TableCell className="text-muted-foreground">{plan.targetDepartment}</TableCell>
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
    </div>
  );
}
