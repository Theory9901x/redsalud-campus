import Link from "next/link";
import { Plus, LayoutDashboard } from "lucide-react";
import { requireTutorOrAdmin } from "@/lib/auth-helpers";
import { getTrainingPlans } from "@/lib/training-plans";
import { buttonVariants } from "@/components/ui/button";
import { TrainingPlanList } from "@/components/training-plans/training-plan-list";
import { cn } from "@/lib/utils";

export default async function AdminPlanesCapacitacionPage() {
  const session = await requireTutorOrAdmin();
  const plans = await getTrainingPlans(session.user.role, session.user.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-foreground">Planes de capacitación</h1>
          <p className="text-sm text-muted-foreground">
            {plans.length} {plans.length === 1 ? "plan" : "planes"} en toda la institución.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/planes-capacitacion/dashboard" className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}>
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Link>
          <Link href="/admin/planes-capacitacion/nuevo" className={cn(buttonVariants(), "gap-1.5")}>
            <Plus className="h-4 w-4" />
            Nuevo plan
          </Link>
        </div>
      </div>

      <TrainingPlanList plans={plans} basePath="/admin/planes-capacitacion" showTutorColumn />
    </div>
  );
}
