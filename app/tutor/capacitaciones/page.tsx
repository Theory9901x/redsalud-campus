import Link from "next/link";
import { requireTutorOrAdmin } from "@/lib/auth-helpers";
import { alcanceAdscripcion } from "@/lib/encuestas/adscripcion";
import { prisma } from "@/lib/prisma";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { COURSE_AUDIENCE_LABELS } from "@/components/cursos/labels";
import { TRAINING_ACTIVITY_STATUS_LABELS } from "@/components/training-plans/labels";

export default async function CapacitacionesIndependientes() {
  const session = await requireTutorOrAdmin();
  const scope = await alcanceAdscripcion(session.user);
  const rows = await prisma.trainingActivity.findMany({
    where: { AND: [scope.actividades, { plan: { isIndependent: true } }] },
    select: { id: true, title: true, planId: true, status: true, targetAudience: true, area: { select: { name: true } } }, orderBy: { createdAt: "desc" },
  });
  return <div className="space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-semibold">Capacitaciones independientes</h1><p className="mt-2 text-base text-muted-foreground">Creadas y administradas por cada área. No forman parte del Plan Institucional de Capacitaciones.</p></div><Link href="/tutor/capacitaciones/nueva" className="rounded-lg bg-primary px-5 py-3 text-base font-semibold text-primary-foreground">Crear capacitación</Link></header>
    <section className="overflow-hidden rounded-xl border bg-card"><Table className="text-base"><TableHeader><TableRow>{["Capacitación", "Área", "Dirigida a", "Estado", "Gestión"].map(t => <TableHead key={t} className="px-4 py-4 text-sm normal-case tracking-normal">{t}</TableHead>)}</TableRow></TableHeader><TableBody>
      {rows.map(r => <TableRow key={r.id}><TableCell className="whitespace-normal px-4 py-4 font-semibold">{r.title}</TableCell><TableCell className="px-4">{r.area?.name}</TableCell><TableCell className="px-4">{COURSE_AUDIENCE_LABELS[r.targetAudience]}</TableCell><TableCell className="px-4">{TRAINING_ACTIVITY_STATUS_LABELS[r.status]}</TableCell><TableCell className="px-4"><Link className="font-semibold text-primary hover:underline" href={`/tutor/capacitaciones/${r.planId}/actividades/${r.id}`}>Administrar</Link></TableCell></TableRow>)}
      {!rows.length && <TableRow><TableCell colSpan={5} className="p-10 text-center text-muted-foreground">Tu área aún no tiene capacitaciones independientes. Crea la primera con el botón superior.</TableCell></TableRow>}
    </TableBody></Table></section>
  </div>;
}
