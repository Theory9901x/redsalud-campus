import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireTrainingPlanAccess } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { createSurveyAction } from "@/app/admin/planes-capacitacion/survey-actions";
import { SurveyForm } from "@/components/training-plans/survey-form";

const BASE_PATH = "/admin/planes-capacitacion";

export default async function AdminNuevaEncuestaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ actividad?: string }>;
}) {
  const { id } = await params;
  const { actividad } = await searchParams;
  await requireTrainingPlanAccess(id);

  const plan = await prisma.trainingPlan.findUnique({
    where: { id },
    select: { title: true, targetDepartment: true },
  });
  if (!plan) notFound();

  let scopeLabel = `Encuesta general del plan "${plan.title}", dirigida a ${plan.targetDepartment}.`;
  let defaultAudience: "ADMINISTRATIVO" | "ASISTENCIAL" | "AMBOS" = "AMBOS";

  if (actividad) {
    const activity = await prisma.trainingActivity.findUnique({
      where: { id: actividad },
      select: { title: true, planId: true, targetAudience: true },
    });
    if (!activity || activity.planId !== id) notFound();
    scopeLabel = `Encuesta para los participantes de la actividad "${activity.title}".`;
    defaultAudience = activity.targetAudience;
  }

  const createAction = createSurveyAction.bind(null, BASE_PATH, id, actividad || null);

  return (
    <div className="space-y-6">
      <Link
        href={actividad ? `${BASE_PATH}/${id}/actividades/${actividad}` : `${BASE_PATH}/${id}`}
        className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver
      </Link>

      <div className="surface mx-auto max-w-2xl p-6">
        <SurveyForm
          action={createAction}
          defaultTargetDepartment={plan.targetDepartment}
          defaultTargetAudience={defaultAudience}
          scopeLabel={scopeLabel}
        />
      </div>
    </div>
  );
}
