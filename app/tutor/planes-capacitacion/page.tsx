import Link from "next/link";
import { Plus } from "lucide-react";
import { requireTutorOrAdmin } from "@/lib/auth-helpers";
import { getTrainingPlans } from "@/lib/training-plans";
import { buttonVariants } from "@/components/ui/button";
import { TrainingPlanList } from "@/components/training-plans/training-plan-list";
import { cn } from "@/lib/utils";

export default async function TutorPlanesCapacitacionPage() {
  const session = await requireTutorOrAdmin();
  const plans = await getTrainingPlans(session.user.role, session.user.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-foreground">Mis planes de capacitación</h1>
          <p className="text-sm text-muted-foreground">
            {plans.length} {plans.length === 1 ? "plan" : "planes"} a tu cargo.
          </p>
        </div>
        <Link href="/tutor/planes-capacitacion/nuevo" className={cn(buttonVariants(), "gap-1.5")}>
          <Plus className="h-4 w-4" />
          Nuevo plan
        </Link>
      </div>

      <TrainingPlanList plans={plans} basePath="/tutor/planes-capacitacion" showTutorColumn={false} />
    </div>
  );
}
