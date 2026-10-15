import Link from "next/link";
import { ArrowUpRight, CalendarClock, FileCheck2, Presentation, Users2, UserRound } from "lucide-react";
import { requireTutorOrAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { listarReuniones } from "@/lib/reuniones";
import { crearReunionAction } from "@/app/admin/reuniones/actions";
import { PestanasModulo } from "@/components/comites/pestanas-modulo";
import { ModuloHero } from "@/components/training-plans/modulo-hero";
import { PanelDeslizable } from "@/components/training-plans/panel-deslizable";
import { escalon } from "@/components/training-plans/plan-visual";
import { FormularioReunion } from "@/components/reuniones/formularios";
import { EmptyState } from "@/components/brand/empty-state";

const FECHA = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Bogota" });

/**
 * REUNIONES ABIERTAS: fuera del PIC y de los comités. Cada reunión tiene una
 * o varias sesiones; cada sesión, su enlace de registro abierto (nombre y
 * cargo), su QR, su sala, su asistencia con permanencia real y su acta.
 */
export default async function ReunionesPage() {
  await requireTutorOrAdmin();
  const [reuniones, anfitriones] = await Promise.all([
    listarReuniones(),
    prisma.user.findMany({
      where: { role: { in: ["ADMIN", "TUTOR"] }, status: "ACTIVE" },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true },
    }),
  ]);

  const totales = reuniones.reduce(
    (t, r) => ({ sesiones: t.sesiones + r.sesiones, abiertas: t.abiertas + r.abiertas, registrados: t.registrados + r.registrados, actas: t.actas + r.actas }),
    { sesiones: 0, abiertas: 0, registrados: 0, actas: 0 }
  );

  return (
    <div className="space-y-6">
      <PestanasModulo activa="reuniones" />
      <ModuloHero
        eyebrow="Reuniones abiertas"
        Icono={Presentation}
        titulo="Reuniones"
        acento="y actas"
        descripcion="Fuera del plan de capacitaciones y de los comités. Se entra solo con nombre completo y cargo; cada sesión tiene su enlace, su QR, su asistencia y su acta en PDF."
        cifras={[
          { valor: reuniones.length, etiqueta: "Reuniones" },
          { valor: totales.sesiones, etiqueta: "Sesiones", detalle: `${totales.abiertas} abiertas` },
          { valor: totales.registrados, etiqueta: "Asistentes registrados" },
          { valor: totales.actas, etiqueta: "Actas firmadas", detalle: `de ${totales.sesiones} sesiones` },
        ]}
        acciones={
          <PanelDeslizable
            etiqueta="Nueva reunión"
            titulo="Nueva reunión abierta"
            descripcion="Define la reunión y sus sesiones. Cada sesión queda con su enlace de registro, su QR y su sala virtual."
          >
            <FormularioReunion action={crearReunionAction} anfitriones={anfitriones.map((a) => ({ id: a.id, nombre: a.fullName }))} />
          </PanelDeslizable>
        }
      />

      {reuniones.length === 0 ? (
        <EmptyState icon={Presentation} title="Todavía no hay reuniones abiertas" description="Crea la primera con el botón «Nueva reunión»." className="py-16" />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {reuniones.map((r, i) => (
            <Link key={r.id} href={`/admin/reuniones/${r.id}`} className="plan-instancia revelar group flex flex-col gap-4 p-5" style={escalon(i)}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="mono-label flex items-center gap-1.5">
                    <Presentation className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> Reunión abierta
                  </p>
                  <h2 className="mt-1.5 font-display text-[1.12rem] font-bold leading-snug tracking-tight text-foreground">{r.titulo}</h2>
                  {r.descripcion && <p className="mt-1 line-clamp-2 text-[12.5px] text-muted-foreground">{r.descripcion}</p>}
                </div>
                <ArrowUpRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
              </div>
              <div className="flex flex-wrap gap-2 text-[12px]">
                <span className="chip-dato"><UserRound className="h-3.5 w-3.5" aria-hidden="true" />{r.responsable}</span>
                {r.primeraFecha && (
                  <span className="chip-dato">
                    <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                    {FECHA.format(r.primeraFecha)}
                    {r.ultimaFecha && FECHA.format(r.ultimaFecha) !== FECHA.format(r.primeraFecha) ? ` – ${FECHA.format(r.ultimaFecha)}` : ""}
                  </span>
                )}
              </div>
              <dl className="grid grid-cols-3 gap-2 border-t border-border/60 pt-3">
                {[
                  { k: "Sesiones", v: r.sesiones, d: r.cerradas ? `${r.cerradas} cerradas` : `${r.abiertas} abiertas`, I: CalendarClock },
                  { k: "Asistentes", v: r.registrados, d: "registrados", I: Users2 },
                  { k: "Actas", v: `${r.actas}/${r.sesiones}`, d: "firmadas", I: FileCheck2 },
                ].map(({ k, v, d, I }) => (
                  <div key={k}>
                    <dt className="mono-label flex items-center gap-1"><I className="h-3 w-3" aria-hidden="true" />{k}</dt>
                    <dd className="mt-1 font-mono text-[1.25rem] font-semibold tabular-nums text-foreground">{v}</dd>
                    <dd className="text-[11px] text-muted-foreground">{d}</dd>
                  </div>
                ))}
              </dl>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
