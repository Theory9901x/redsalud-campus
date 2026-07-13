import Link from "next/link";
import { Plus, LayoutDashboard } from "lucide-react";
import { requireTutorOrAdmin } from "@/lib/auth-helpers";
import { getTrainingPlans } from "@/lib/training-plans";
import { buttonVariants } from "@/components/ui/button";
import { TrainingPlanList } from "@/components/training-plans/training-plan-list";
import { AdminPageHeader } from "@/components/admin/page-header";
import { cn } from "@/lib/utils";

export default async function AdminPlanesCapacitacionPage() {
  const session = await requireTutorOrAdmin();
  const plans = await getTrainingPlans(session.user.role, session.user.id);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Planes de capacitación"
        description={`${plans.length} ${plans.length === 1 ? "plan" : "planes"} en toda la institución.`}
        action={
          <>
            <Link href="/admin/planes-capacitacion/dashboard" className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}>
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Link>
            <Link
              href="/admin/planes-capacitacion/nuevo"
              className={cn(buttonVariants(), "gap-1.5 bg-gradient-to-r from-primary to-teal-400 text-white hover:opacity-90")}
            >
              <Plus className="h-4 w-4" />
              Nuevo plan
            </Link>
          </>
        }
      />

      <TrainingPlanList plans={plans} basePath="/admin/planes-capacitacion" showTutorColumn />
    </div>
  );
}
