import Link from "next/link";
import { ArrowRight, CalendarClock, FileText, Gavel, Plus, Users2 } from "lucide-react";
import { requireTutorOrAdmin } from "@/lib/auth-helpers";
import { listarComites } from "@/lib/comites";
import { etiquetaFecha, etiquetaHora } from "@/components/training-plans/labels";
import { PestanasModulo } from "@/components/comites/pestanas-modulo";
import { AdminPageHeader } from "@/components/admin/page-header";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/brand/empty-state";
import { cn } from "@/lib/utils";

/**
 * COMITÉS: listado del submódulo. Gestión y medición aparte de los planes
 * de capacitación, con la misma maquinaria de reuniones y salas.
 */
export default async function ComitesPage() {
  await requireTutorOrAdmin();
  const comites = await listarComites();

  return (
    <div className="space-y-6">
      <PestanasModulo activa="comites" />
      <AdminPageHeader
        title="Comités institucionales"
        description={`${comites.length} ${comites.length === 1 ? "comité conformado" : "comités conformados"} por resolución, con sus integrantes, reuniones y asistencia.`}
        action={
          <Link href="/admin/comites/nuevo" className={cn(buttonVariants(), "gap-1.5 bg-gradient-to-r from-primary to-teal-400 text-white hover:opacity-90")}>
            <Plus className="h-4 w-4" />
            Nuevo comité
          </Link>
        }
      />

      {comites.length === 0 ? (
        <EmptyState icon={Gavel} title="Todavía no hay comités" description="Crea el primero con su resolución de conformación e integrantes." className="py-16" />
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {comites.map((c) => {
            const semaforo =
              c.asistenciaPromedio === null
                ? "text-muted-foreground"
                : c.asistenciaPromedio >= 85
                  ? "text-success"
                  : c.asistenciaPromedio >= 70
                    ? "text-warning-foreground"
                    : "text-destructive";
            return (
              <Link key={c.id} href={`/admin/comites/${c.id}`} className="comite-tarjeta group block p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.18em] text-primary">
                      <Gavel className="h-3.5 w-3.5" aria-hidden="true" />
                      {c.resolutionNumber ? `Resolución ${c.resolutionNumber}` : "Comité"}
                      {c.periodLabel ? ` · ${c.periodLabel}` : ""}
                    </p>
                    <h2 className="mt-2 font-display text-[1.35rem] font-extrabold leading-tight tracking-tight text-foreground">{c.title}</h2>
                    {c.summary && <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">{c.summary}</p>}
                  </div>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary transition-transform group-hover:translate-x-0.5">
                    <ArrowRight className="h-4.5 w-4.5" aria-hidden="true" />
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-3">
                  <div className="rounded-2xl bg-card/70 p-3.5">
                    <p className="font-display text-[1.5rem] font-extrabold leading-none tabular-nums text-foreground">{c._count.members}</p>
                    <p className="mt-1 flex items-center gap-1 text-[11.5px] text-muted-foreground">
                      <Users2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Integrantes
                    </p>
                  </div>
                  <div className="rounded-2xl bg-card/70 p-3.5">
                    <p className="font-display text-[1.5rem] font-extrabold leading-none tabular-nums text-foreground">{c._count.activities}</p>
                    <p className="mt-1 flex items-center gap-1 text-[11.5px] text-muted-foreground">
                      <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                      Reuniones
                    </p>
                  </div>
                  <div className="rounded-2xl bg-card/70 p-3.5">
                    <p className={cn("font-display text-[1.5rem] font-extrabold leading-none tabular-nums", semaforo)}>
                      {c.asistenciaPromedio === null ? "—" : `${c.asistenciaPromedio}%`}
                    </p>
                    <p className="mt-1 text-[11.5px] text-muted-foreground">Asistencia</p>
                  </div>
                </div>

                <p className="mt-4 flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                  <FileText className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                  {c.proximaReunion
                    ? `Próxima reunión: ${etiquetaFecha(c.proximaReunion)}, ${etiquetaHora(c.proximaReunion)}`
                    : "Sin reuniones próximas agendadas"}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
