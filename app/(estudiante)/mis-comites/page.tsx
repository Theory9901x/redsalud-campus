import Link from "next/link";
import { ArrowRight, CalendarClock, Gavel, Users2, Video } from "lucide-react";
import { requireSession } from "@/lib/auth-helpers";
import { listarComitesDeUsuario, ROL_COMITE } from "@/lib/comites";
import { etiquetaFecha, etiquetaHora } from "@/components/training-plans/labels";
import { EmptyState } from "@/components/brand/empty-state";

/** "Mis comités": los comités a los que pertenece la persona, solo lectura. */
export default async function MisComitesPage() {
  const session = await requireSession("/mis-comites");
  const comites = await listarComitesDeUsuario(session.user.id);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <header>
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
          <Gavel className="h-3.5 w-3.5" aria-hidden="true" />
          Comités institucionales
        </p>
        <h1 className="mt-2 font-display text-[clamp(1.6rem,3.4vw,2.1rem)] font-extrabold leading-tight tracking-tight text-foreground">Mis comités</h1>
        <p className="mt-1 text-sm text-muted-foreground">Los comités de los que eres integrante, con sus reuniones y el acceso directo a la sala.</p>
      </header>

      {comites.length === 0 ? (
        <EmptyState icon={Gavel} title="No perteneces a ningún comité" description="Cuando una resolución te designe como integrante, aparecerá aquí." className="py-16" />
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {comites.map((c) => (
            <Link key={c.plan.id} href={`/mis-comites/${c.plan.id}`} className="comite-tarjeta group block p-6">
              <p className="text-[10.5px] font-extrabold uppercase tracking-[0.18em] text-primary">
                {c.plan.resolutionNumber ? `Resolución ${c.plan.resolutionNumber}` : "Comité"}
                {c.plan.periodLabel ? ` · ${c.plan.periodLabel}` : ""}
              </p>
              <div className="mt-2 flex items-start justify-between gap-3">
                <h2 className="font-display text-[1.3rem] font-extrabold leading-tight tracking-tight text-foreground">{c.plan.title}</h2>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary transition-transform group-hover:translate-x-0.5">
                  <ArrowRight className="h-4.5 w-4.5" aria-hidden="true" />
                </span>
              </div>
              <p className="mt-2 text-[13px] text-muted-foreground">
                <b className="text-foreground">{ROL_COMITE[c.role].etiqueta}</b> · {c.zone}
                {c.position ? ` · ${c.position}` : ""}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-card/70 p-3.5">
                  <p className="font-display text-[1.4rem] font-extrabold leading-none tabular-nums text-foreground">{c.plan._count.members}</p>
                  <p className="mt-1 flex items-center gap-1 text-[11.5px] text-muted-foreground"><Users2 className="h-3.5 w-3.5" aria-hidden="true" />Integrantes</p>
                </div>
                <div className="rounded-2xl bg-card/70 p-3.5">
                  <p className="font-display text-[1.4rem] font-extrabold leading-none tabular-nums text-foreground">{c.plan._count.activities}</p>
                  <p className="mt-1 flex items-center gap-1 text-[11.5px] text-muted-foreground"><CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />Reuniones</p>
                </div>
              </div>
              {c.proxima && (
                <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1 text-[12px] font-bold text-success">
                  <Video className="h-3.5 w-3.5" aria-hidden="true" />
                  Próxima: {etiquetaFecha(c.proxima.inicio)} · {etiquetaHora(c.proxima.inicio)}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
