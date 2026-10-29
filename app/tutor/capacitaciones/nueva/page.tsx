import Link from "next/link";
import { requireTutorOrAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { CrearCapacitacionArea } from "@/components/training-plans/crear-capacitacion-area";

export default async function NuevaCapacitacionArea() {
  const session = await requireTutorOrAdmin();
  const areas = await prisma.trainingArea.findMany({ where: { tutorId: session.user.id, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  return <div className="mx-auto max-w-3xl space-y-6">
    <Link href="/tutor/capacitaciones" className="text-base font-semibold text-primary hover:underline">← Capacitaciones independientes</Link>
    <header><h1 className="text-3xl font-semibold">Nueva capacitación independiente</h1><p className="mt-2 text-base leading-relaxed text-muted-foreground">Creada y administrada por tu área. No modifica el Plan Institucional de Capacitaciones.</p></header>
    <section className="rounded-2xl border border-border bg-card p-6 sm:p-8"><CrearCapacitacionArea areas={areas} /></section>
  </div>;
}
