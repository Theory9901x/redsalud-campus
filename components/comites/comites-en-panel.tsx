import Link from "next/link";
import { ArrowRight, CalendarClock, Gavel, Video } from "lucide-react";
import { listarComitesDeUsuario, ROL_COMITE } from "@/lib/comites";
import { etiquetaFecha, etiquetaHora } from "@/components/training-plans/labels";

/**
 * Tarjeta en el panel del estudiante: solo aparece si la persona es
 * integrante de algún comité. Muestra su rol y la próxima reunión con el
 * botón directo a la sala.
 */
export async function ComitesEnPanel({ userId }: { userId: string }) {
  const comites = await listarComitesDeUsuario(userId);
  if (comites.length === 0) return null;

  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {comites.map((c) => (
        <div key={c.plan.id} className="comite-hero p-5">
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.18em] text-white/70">
                <Gavel className="h-3.5 w-3.5" aria-hidden="true" />
                Soy integrante · {c.zone}
              </p>
              <h2 className="mt-1.5 font-display text-[1.2rem] font-extrabold leading-tight">{c.plan.title}</h2>
              <p className="mt-1 text-[12.5px] text-white/80">{ROL_COMITE[c.role].etiqueta}</p>
            </div>
            <Link href={`/mis-comites/${c.plan.id}`} className="comite-vidrio grid h-10 w-10 shrink-0 place-items-center text-white" aria-label="Ver el comité">
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="comite-vidrio relative mt-4 flex flex-wrap items-center justify-between gap-3 p-3.5">
            {c.proxima ? (
              <>
                <div className="min-w-0">
                  <p className="text-[10.5px] font-extrabold uppercase tracking-[0.16em] text-white/70">Próxima reunión</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[13.5px] font-bold">
                    <CalendarClock className="h-4 w-4" aria-hidden="true" />
                    {etiquetaFecha(c.proxima.inicio)} · {etiquetaHora(c.proxima.inicio)}
                  </p>
                </div>
                <Link href={`/sala/${c.proxima.actividad.id}`} className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-[12.5px] font-bold text-[#0f2438]">
                  <Video className="h-4 w-4" aria-hidden="true" />
                  Entrar a la reunión
                </Link>
              </>
            ) : (
              <p className="text-[13px] text-white/80">Sin reuniones próximas agendadas.</p>
            )}
          </div>
        </div>
      ))}
    </section>
  );
}
