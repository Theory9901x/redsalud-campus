import Link from "next/link";
import { ArrowLeft, Building2, CalendarRange, ClipboardCheck, Gauge, PhoneCall } from "lucide-react";
import { ModuloHero } from "@/components/training-plans/modulo-hero";
import {
  AnilloPorcentaje,
  AvatarIniciales,
  PildoraEstado,
  RielTrimestres,
  conteoPorTrimestre,
} from "@/components/training-plans/plan-visual";
import { TRAINING_PLAN_STATUS_LABELS } from "@/components/training-plans/labels";
import type { TrainingActivityStatus, TrainingPlanStatus } from "@prisma/client";

/**
 * Cabecera de UN plan (admin y tutor): la misma pieza en las dos vistas para
 * que el plan se vea igual sin importar quién lo abra.
 */
export function PlanHero({
  basePath,
  plan,
  cumplimiento,
}: {
  basePath: string;
  plan: {
    id: string;
    title: string;
    year: number;
    status: TrainingPlanStatus;
    targetDepartment: string | null;
    tutor: { fullName: string };
    activities: { quarters: number[]; status: TrainingActivityStatus; courseId: string | null; _count?: { sessions: number } }[];
  };
  cumplimiento: number | null;
}) {
  const acts = plan.activities;
  const jornadas = acts.reduce((s, a) => s + (a._count?.sessions ?? 0), 0);

  return (
    <div className="space-y-3">
      <Link href={basePath} className="inline-flex w-fit items-center gap-1.5 rounded-full px-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Planes de capacitación
      </Link>

      <ModuloHero
        eyebrow={`Plan de capacitación · ${plan.year}`}
        Icono={CalendarRange}
        titulo={plan.title}
        descripcion={
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <PildoraEstado estado={plan.status}>{TRAINING_PLAN_STATUS_LABELS[plan.status]}</PildoraEstado>
            <span className="inline-flex items-center gap-1.5 text-white/80">
              <Building2 className="h-4 w-4" aria-hidden="true" />
              {plan.targetDepartment ?? "Todo el personal"}
            </span>
            <span className="inline-flex items-center gap-2 text-white/80">
              <AvatarIniciales nombre={plan.tutor.fullName} className="!shadow-none" />
              {plan.tutor.fullName}
            </span>
          </div>
        }
        acciones={
          <>
            <Link href={`${basePath}/${plan.id}/indicadores`} className="enlace-hero">
              <Gauge className="h-4 w-4" aria-hidden="true" />
              Indicadores
            </Link>
            <Link href={`${basePath}/${plan.id}/conexiones`} className="enlace-hero">
              <PhoneCall className="h-4 w-4" aria-hidden="true" />
              Conexiones a la sala
            </Link>
          </>
        }
        lateral={<AnilloPorcentaje valor={cumplimiento} tamano={112} grosor={10} oscuro etiqueta="Cumplimiento" />}
        cifras={[
          { valor: acts.length, etiqueta: "Capacitaciones" },
          { valor: acts.filter((a) => a.status === "OPEN").length, etiqueta: "Abiertas" },
          { valor: acts.filter((a) => a.status === "CLOSED").length, etiqueta: "Cerradas" },
          { valor: jornadas, etiqueta: "Jornadas agendadas" },
        ]}
        pie={
          acts.length > 0 ? (
            <div className="space-y-2">
              <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-white/55">
                <ClipboardCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Programación por trimestre
              </p>
              <RielTrimestres conteos={conteoPorTrimestre(acts)} oscuro conMeses />
            </div>
          ) : undefined
        }
      />
    </div>
  );
}
