import Link from "next/link";
import { ArrowUpRight, Building2, CalendarRange } from "lucide-react";
import { DeleteEntityButton } from "@/components/admin/delete-entity-button";
import { deleteTrainingPlanAction } from "@/app/admin/planes-capacitacion/actions";
import { EmptyState } from "@/components/brand/empty-state";
import { TRAINING_PLAN_STATUS_LABELS } from "@/components/training-plans/labels";
import {
  AvatarIniciales,
  PildoraEstado,
  RielTrimestres,
  conteoPorTrimestre,
  escalon,
} from "@/components/training-plans/plan-visual";
import { FocoCursor } from "@/components/training-plans/plan-dinamico";
import type { TrainingActivityStatus, TrainingPlanStatus } from "@prisma/client";

export type TrainingPlanListItem = {
  id: string;
  title: string;
  year: number;
  targetDepartment: string | null;
  status: TrainingPlanStatus;
  tutor: { fullName: string };
  _count: { activities: number };
  /** Para el riel de trimestres y el avance; opcional para no romper llamadores viejos. */
  activities?: { quarters: number[]; status: TrainingActivityStatus; courseId: string | null }[];
};

/**
 * Planes como TARJETAS-INSTANCIA: cada plan con su estado (cinta lateral y
 * píldora), su riel de trimestres, el avance de jornadas cerradas y su
 * responsable. Reemplaza la tabla plana: aquí se lee de un vistazo en qué
 * va cada plan y qué le toca este trimestre.
 */
export function TrainingPlanList({
  plans,
  basePath,
  showTutorColumn,
  /** Solo el admin elimina planes. */
  puedeEliminar = false,
}: {
  plans: TrainingPlanListItem[];
  basePath: string;
  showTutorColumn: boolean;
  puedeEliminar?: boolean;
}) {
  if (plans.length === 0) {
    return (
      <EmptyState
        icon={CalendarRange}
        title="Aún no hay planes de capacitación"
        description="Crea el primero para empezar a planificar el cronograma institucional."
      />
    );
  }

  return (
    <FocoCursor className="grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-3">
      {plans.map((plan, i) => {
        const acts = plan.activities ?? [];
        const total = plan._count.activities;
        const abiertas = acts.filter((a) => a.status === "OPEN").length;
        const cerradas = acts.filter((a) => a.status === "CLOSED").length;
        const conCurso = acts.filter((a) => a.courseId).length;
        const avance = total > 0 ? Math.round((cerradas / total) * 100) : 0;

        return (
          <article key={plan.id} className="plan-instancia revelar flex flex-col p-6" data-estado={plan.status} style={escalon(i)}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <PildoraEstado estado={plan.status}>{TRAINING_PLAN_STATUS_LABELS[plan.status]}</PildoraEstado>
                <span className="codigo-plan">PLN-{plan.year}·{plan.id.slice(-4).toUpperCase()}</span>
              </div>
              <div className="sobre-enlace flex items-center gap-1">
                {puedeEliminar && (
                  <DeleteEntityButton
                    action={deleteTrainingPlanAction.bind(null, basePath, plan.id)}
                    nombre={plan.title}
                    descripcion={`Se elimina el plan con sus ${total} jornada(s), encuestas y documentos. No se puede deshacer.`}
                  />
                )}
              </div>
            </div>

            <h2 className="mt-4 font-display text-[1.12rem] font-bold leading-snug tracking-tight text-foreground">
              <Link href={`${basePath}/${plan.id}`} className="enlace-tarjeta outline-none focus-visible:underline">
                {plan.title}
              </Link>
            </h2>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12.5px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                {plan.targetDepartment ?? "Todo el personal"}
              </span>
              {showTutorColumn && (
                <span className="inline-flex items-center gap-2">
                  <AvatarIniciales nombre={plan.tutor.fullName} />
                  <span className="truncate">{plan.tutor.fullName}</span>
                </span>
              )}
            </div>

            {acts.length > 0 && (
              <div className="mt-5">
                <RielTrimestres conteos={conteoPorTrimestre(acts)} />
              </div>
            )}

            <div className="mt-5 grid grid-cols-4 gap-3 border-t border-border/60 pt-4">
              <div className="dato-mini"><b>{total}</b><span>Activid.</span></div>
              <div className="dato-mini"><b className="text-success">{abiertas}</b><span>Abiertas</span></div>
              <div className="dato-mini"><b>{cerradas}</b><span>Cerradas</span></div>
              <div className="dato-mini"><b>{conCurso}</b><span>Con curso</span></div>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <div className="medidor flex-1" role="img" aria-label={`${avance}% de las capacitaciones cerradas`}>
                {avance > 0 && <span style={{ width: `${avance}%`, animationDelay: `${i * 60}ms` }} />}
              </div>
              <span className="mono-label shrink-0 !tracking-[0.08em]">{avance}% cerrado</span>
              <span className="flecha grid h-8 w-8 shrink-0 place-items-center rounded-[9px] border border-primary/25 bg-primary/8 text-primary">
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </span>
            </div>
          </article>
        );
      })}
    </FocoCursor>
  );
}
