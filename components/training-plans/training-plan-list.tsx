import Link from "next/link";
import { CalendarRange, Pencil } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/brand/empty-state";
import { TRAINING_PLAN_STATUS_LABELS, TRAINING_PLAN_STATUS_CLASSES } from "@/components/training-plans/labels";
import type { TrainingPlanStatus } from "@prisma/client";

export type TrainingPlanListItem = {
  id: string;
  title: string;
  year: number;
  targetDepartment: string | null;
  status: TrainingPlanStatus;
  tutor: { fullName: string };
  _count: { activities: number };
};

export function TrainingPlanList({
  plans,
  basePath,
  showTutorColumn,
}: {
  plans: TrainingPlanListItem[];
  basePath: string;
  showTutorColumn: boolean;
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
    <div className="surface overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Plan</TableHead>
            <TableHead>Año</TableHead>
            <TableHead>Proceso / área</TableHead>
            {showTutorColumn && <TableHead>Tutor responsable</TableHead>}
            <TableHead className="text-center">Actividades</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {plans.map((plan) => (
            <TableRow key={plan.id}>
              <TableCell>
                <Link href={`${basePath}/${plan.id}`} className="font-medium text-foreground hover:underline">
                  {plan.title}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">{plan.year}</TableCell>
              <TableCell className="text-muted-foreground">{plan.targetDepartment ?? "Todo el personal"}</TableCell>
              {showTutorColumn && <TableCell className="text-muted-foreground">{plan.tutor.fullName}</TableCell>}
              <TableCell className="text-center text-muted-foreground">{plan._count.activities}</TableCell>
              <TableCell>
                <Badge className={TRAINING_PLAN_STATUS_CLASSES[plan.status]}>
                  {TRAINING_PLAN_STATUS_LABELS[plan.status]}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end">
                  <Link
                    href={`${basePath}/${plan.id}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-primary hover:bg-primary/10"
                    title="Ver / gestionar"
                  >
                    <Pencil className="h-4 w-4" />
                  </Link>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
