import Link from "next/link";
import { ArrowRight, Gavel, Video } from "lucide-react";
import { requireSession } from "@/lib/auth-helpers";
import { listarComitesDeUsuario, ROL_COMITE } from "@/lib/comites";
import { etiquetaFecha, etiquetaHora } from "@/components/training-plans/labels";
import { SeccionAgenda } from "@/components/agenda/fila-agenda";

/**
 * «Mis comités»: los comités a los que pertenece la persona, como lista. Cada
 * fila dice qué comité es, con qué rol está y cuándo es la próxima reunión,
 * con el botón de entrar cuando hay una agendada.
 */
export default async function MisComitesPage() {
  const session = await requireSession("/mis-comites");
  const comites = await listarComitesDeUsuario(session.user.id);

  return (
    <main className="canvas-formacion min-h-full flex-1">
      <div className="mx-auto w-full max-w-[1280px] space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <header className="max-w-2xl">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">Mis comités</h1>
          <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">
            Los comités de los que eres integrante, con su próxima reunión y el acceso a la sala.
          </p>
        </header>

        <SeccionAgenda titulo="Comités" conteo={comites.length}>
          {comites.length === 0 ? (
            <p className="agenda-vacio">
              <b>No perteneces a ningún comité</b>
              Cuando una resolución te designe como integrante, aparecerá aquí.
            </p>
          ) : (
            <ul>
              {comites.map((c) => (
                <li key={c.plan.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-border px-5 py-4 last:border-b-0">
                  <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
                    <Gavel className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1 basis-64">
                    <p className="agenda-titulo">{c.plan.title}</p>
                    <p className="agenda-detalle">
                      <span>{ROL_COMITE[c.role].etiqueta}</span>
                      <span>{c.zone}</span>
                      {c.plan.resolutionNumber && <span>Resolución {c.plan.resolutionNumber}</span>}
                      <span>{c.plan._count.members} integrantes</span>
                    </p>
                  </div>
                  <p className="basis-56 text-sm text-muted-foreground">
                    {c.proxima ? (
                      <>
                        <span className="block text-[13px]">Próxima reunión</span>
                        <b className="font-semibold text-foreground">
                          {etiquetaFecha(c.proxima.inicio)} · {etiquetaHora(c.proxima.inicio)}
                        </b>
                      </>
                    ) : (
                      "Sin reuniones próximas agendadas"
                    )}
                  </p>
                  <div className="agenda-acciones">
                    {c.proxima && (
                      <Link href={`/sala/${c.proxima.actividad.id}`} className="btn-agenda" data-variante="principal">
                        <Video className="h-4 w-4" aria-hidden="true" />
                        Entrar a la reunión
                      </Link>
                    )}
                    <Link href={`/mis-comites/${c.plan.id}`} className="btn-agenda" data-variante="secundario">
                      Ver comité
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SeccionAgenda>
      </div>
    </main>
  );
}
