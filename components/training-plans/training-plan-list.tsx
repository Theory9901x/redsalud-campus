import Link from "next/link";
import { ArrowUpRight, Building2, CalendarRange } from "lucide-react";
import { DeleteEntityButton } from "@/components/admin/delete-entity-button";
import { deleteTrainingPlanAction } from "@/app/admin/planes-capacitacion/actions";
import { EmptyState } from "@/components/brand/empty-state";
import { TRAINING_PLAN_STATUS_LABELS } from "@/components/training-plans/labels";
import {
  AnilloPorcentaje,
  AvatarIniciales,
  GraficoTrimestres,
  PildoraEstado,
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
          <article key={plan.id} className="plan-instancia revelar flex flex-col" data-estado={plan.status} style={escalon(i)}>
            {/* Cabecera: estado, código y acciones */}
            <div className="flex items-center justify-between gap-3 px-6 pt-5">
              <div className="flex items-center gap-2.5">
                <PildoraEstado estado={plan.status}>{TRAINING_PLAN_STATUS_LABELS[plan.status]}</PildoraEstado>
                <span className="codigo-plan">PLN-{plan.year}·{plan.id.slice(-4).toUpperCase()}</span>
              </div>
              {puedeEliminar && (
                <div className="sobre-enlace">
                  <DeleteEntityButton
                    action={deleteTrainingPlanAction.bind(null, basePath, plan.id)}
                    nombre={plan.title}
                    descripcion={`Se elimina el plan con sus ${total} jornada(s), encuestas y documentos. No se puede deshacer.`}
                  />
                </div>
              )}
            </div>

            <div className="px-6 pt-3">
              <h2 className="font-display text-[1.15rem] font-bold leading-snug tracking-tight text-foreground">
                <Link href={`${basePath}/${plan.id}`} className="enlace-tarjeta outline-none focus-visible:underline">
                  {plan.title}
                </Link>
              </h2>
              <p className="mt-1.5 inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                <Building2 className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                {plan.targetDepartment ?? "Todo el personal"}
              </p>
            </div>

            {/* Cuerpo: programación por trimestre + avance */}
            <div className="mt-5 flex items-end gap-5 px-6">
              <div className="min-w-0 flex-1">
                <p className="mono-label mb-2">Por trimestre</p>
                <GraficoTrimestres conteos={conteoPorTrimestre(acts)} />
              </div>
              <div className="flex shrink-0 flex-col items-center gap-1.5 pb-1">
                <AnilloPorcentaje valor={total > 0 ? avance : null} tamano={88} grosor={6} etiqueta="Avance" />
              </div>
            </div>

            {/* Panel de cifras, como un tablero */}
            <div className="panel-cifras mx-6 mt-5 grid grid-cols-4">
              <div className="dato-mini"><b>{total}</b><span>Activid.</span></div>
              <div className="dato-mini"><b className="text-success">{abiertas}</b><span>Abiertas</span></div>
              <div className="dato-mini"><b>{cerradas}</b><span>Cerradas</span></div>
              <div className="dato-mini"><b>{conCurso}</b><span>Con curso</span></div>
            </div>

            {/* Pie: responsable y acceso */}
            <div className="mt-auto flex items-center justify-between gap-3 px-6 pb-5 pt-4">
              {showTutorColumn ? (
                <span className="inline-flex min-w-0 items-center gap-2 text-[12.5px] text-muted-foreground">
                  <AvatarIniciales nombre={plan.tutor.fullName} />
                  <span className="truncate">{plan.tutor.fullName}</span>
                </span>
              ) : (
                <span className="mono-label">{plan.year}</span>
              )}
              <span className="flecha inline-flex shrink-0 items-center gap-1.5 rounded-[10px] border border-primary/25 bg-primary/8 px-3 py-1.5 text-[12px] font-semibold text-primary">
                Abrir plan
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            </div>
          </article>
        );
      })}
    </FocoCursor>
  );
}
