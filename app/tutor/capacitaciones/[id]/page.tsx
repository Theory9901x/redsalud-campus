import { redirect } from "next/navigation";
import { requireTrainingPlanRead } from "@/lib/auth-helpers";
export default async function GrupoIndependiente({ params }: { params: Promise<{ id: string }> }) {
  await requireTrainingPlanRead((await params).id);
  redirect("/tutor/capacitaciones");
}
