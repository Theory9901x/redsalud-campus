import Link from "next/link";
import { requireTutorOrAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { CrearCapacitacionArea } from "@/components/training-plans/crear-capacitacion-area";

export default async function NuevaCapacitacionArea({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const session = await requireTutorOrAdmin();
  const { plan } = await searchParams;
  const areas = await prisma.trainingArea.findMany({ where: { tutorId: session.user.id, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  const planes = await prisma.trainingPlan.findMany({ where: {
    kind: "CAPACITACION", status: "ACTIVE",
    NOT: [{ title: { startsWith: "[PRUEBA]" } }, { title: { startsWith: "[DEMO]" } }],
    OR: [{ targetDepartment: null }, { targetDepartment: { in: areas.map(a => a.name), mode: "insensitive" } }],
  }, select: { id: true, title: true }, orderBy: [{ year: "desc" }, { title: "asc" }] });
  return <div className="mx-auto max-w-3xl space-y-6">
    <Link href="/tutor/planes-capacitacion" className="text-base font-semibold text-primary hover:underline">← Mis capacitaciones</Link>
    <header><h1 className="text-3xl font-semibold">Nueva capacitación de mi área</h1><p className="mt-2 text-base leading-relaxed text-muted-foreground">Crea una capacitación propia y completa su contenido desde la ficha de gestión.</p></header>
    <section className="rounded-2xl border border-border bg-card p-6 sm:p-8"><CrearCapacitacionArea areas={areas} planes={planes} planInicial={plan} /></section>
  </div>;
}
