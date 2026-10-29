import Link from "next/link";
import { requireSession } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { PestanasCapacitaciones } from "@/components/en-vivo/pestanas-capacitaciones";
import { TRAINING_MODALITY_LABELS } from "@/components/training-plans/labels";

export default async function IndependientesDelPersonal() {
  const session = await requireSession();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id }, select: { personnelType: true, department: true } });
  const rows = await prisma.trainingActivity.findMany({ where: {
    status: "OPEN", manuallyHidden: false, targetAudience: { in: [user.personnelType, "AMBOS"] },
    plan: { isIndependent: true, status: "ACTIVE", OR: [{ targetDepartment: null }, ...(user.department ? [{ targetDepartment: user.department }] : [])] },
  }, select: { id: true, title: true, objective: true, modality: true, courseId: true, area: { select: { name: true } }, sessions: { where: { status: { not: "CLOSED" } }, orderBy: { startsAt: "desc" }, take: 1, select: { tokenPublico: true, startsAt: true } } }, orderBy: { createdAt: "desc" } });
  return <main className="mx-auto w-full max-w-6xl space-y-6 p-6"><PestanasCapacitaciones activa="independientes" enVivo={0} /><header><h1 className="text-3xl font-semibold">Capacitaciones independientes</h1><p className="mt-2 text-base text-muted-foreground">Publicadas por las áreas para tu grupo de personal, por fuera del PIC.</p></header>
    <div className="space-y-4">{rows.map(r => <article key={r.id} className="space-y-3 rounded-xl border bg-card p-6"><p className="text-sm font-semibold text-primary">{r.area?.name} · {TRAINING_MODALITY_LABELS[r.modality]}</p><h2 className="text-xl font-semibold">{r.title}</h2><p className="text-base text-muted-foreground">{r.objective}</p><div className="flex flex-wrap gap-4"><Link href={`/c/${r.id}/meet${r.sessions[0] ? `?s=${r.sessions[0].tokenPublico}` : ""}`} className="rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground">Ingresar a la capacitación</Link>{r.courseId && <Link href={`/c/${r.id}/presaber`} className="rounded-lg border px-4 py-2 font-semibold">Evaluación</Link>}</div></article>)}{!rows.length && <p className="rounded-xl border bg-card p-8 text-base text-muted-foreground">No hay capacitaciones independientes habilitadas para tu grupo de personal.</p>}</div>
  </main>;
}
