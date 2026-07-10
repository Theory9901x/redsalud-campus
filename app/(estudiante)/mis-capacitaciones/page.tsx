import Link from "next/link";
import { CalendarRange, Building2, User } from "lucide-react";
import { auth } from "@/auth";
import { getTrainingPlansForStudent } from "@/lib/training-plans";
import { EmptyState } from "@/components/brand/empty-state";
import { StaggerSections } from "@/components/brand/stagger-sections";

export default async function MisCapacitacionesPage() {
  const session = await auth();
  const userId = session!.user.id;

  const plans = await getTrainingPlansForStudent(userId);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
      <StaggerSections className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-foreground">Mis capacitaciones</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Planes de capacitación institucional dirigidos a ti: cronograma, documentos y evaluaciones.
          </p>
        </div>

        {plans.length === 0 ? (
          <div className="surface-panel p-6 sm:p-8">
            <EmptyState
              icon={CalendarRange}
              title="Sin planes asignados"
              description="Cuando tengas un plan de capacitación asignado, aparecerá aquí."
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {plans.map((plan) => (
              <Link
                key={plan.id}
                href={`/mis-capacitaciones/${plan.id}`}
                className="surface surface-hover surface-accent-top flex flex-col gap-3 p-5"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <CalendarRange className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-display text-sm font-bold text-foreground">{plan.title}</p>
                    <p className="text-xs text-muted-foreground">{plan.year}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5 text-primary" />
                    {plan.targetDepartment ?? "Todo el personal"}
                  </span>
                  <span className="flex items-center gap-1">
                    <User className="h-3.5 w-3.5 text-primary" />
                    {plan.tutor.fullName}
                  </span>
                  <span>
                    {plan._count.activities} {plan._count.activities === 1 ? "actividad" : "actividades"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </StaggerSections>
    </main>
  );
}
