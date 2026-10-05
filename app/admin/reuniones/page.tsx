import Link from "next/link";
import QRCode from "qrcode";
import { CalendarClock, ClipboardList, Download, ExternalLink, MapPin, Presentation, Users2, Video } from "lucide-react";
import { requireTutorOrAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { etiquetaJornada } from "@/components/training-plans/labels";
import { PestanasModulo } from "@/components/comites/pestanas-modulo";
import { BotonCopiar } from "@/components/comites/formularios";
import { AdminPageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/brand/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * REUNIONES ABIERTAS: tercer submódulo, fuera del PIC y de los comités. Cada
 * sesión es independiente -su enlace, su QR y su lista de asistencia-, y el
 * acceso es abierto: nombre completo y cargo.
 */
export default async function ReunionesPage() {
  await requireTutorOrAdmin();
  const reuniones = await prisma.trainingPlan.findMany({
    where: { kind: "REUNION", status: { not: "ARCHIVED" } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      activities: {
        orderBy: { startDate: "asc" },
        select: {
          id: true,
          title: true,
          status: true,
          targetAudienceNote: true,
          responsibleLabel: true,
          sessions: { orderBy: { startsAt: "asc" }, take: 1, select: { startsAt: true, endsAt: true } },
          _count: { select: { externalParticipants: true } },
        },
      },
    },
  });

  const qrs = new Map<string, string>();
  for (const r of reuniones) {
    for (const a of r.activities) {
      qrs.set(a.id, await QRCode.toDataURL(`${APP_URL}/invitado/${a.id}`, { width: 600, margin: 2, errorCorrectionLevel: "M" }));
    }
  }

  return (
    <div className="space-y-6">
      <PestanasModulo activa="reuniones" />
      <AdminPageHeader
        title="Reuniones abiertas"
        description="Reuniones fuera del plan de capacitaciones y de los comités. Se entra solo con nombre completo y cargo; cada sesión tiene su enlace, su QR y su asistencia."
      />

      {reuniones.length === 0 ? (
        <EmptyState icon={Presentation} title="Todavía no hay reuniones abiertas" description="Las reuniones abiertas aparecerán aquí con sus sesiones." className="py-16" />
      ) : (
        reuniones.map((r) => (
          <section key={r.id} className="space-y-4">
            <div>
              <p className="flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.18em] text-primary">
                <Presentation className="h-3.5 w-3.5" aria-hidden="true" /> Reunión abierta
              </p>
              <h2 className="mt-1 font-display text-[1.45rem] font-extrabold leading-tight tracking-tight text-foreground">{r.title}</h2>
              {r.description && <p className="mt-1 text-[13px] text-muted-foreground">{r.description}</p>}
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {r.activities.map((a) => {
                const enlace = `${APP_URL}/invitado/${a.id}`;
                const sesion = a.sessions[0];
                const qr = qrs.get(a.id)!;
                return (
                  <article key={a.id} className="comite-tarjeta flex flex-col gap-4 p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-display text-[1.05rem] font-extrabold leading-snug text-foreground">{a.title.replace(`${r.title} · `, "")}</h3>
                        <ul className="mt-2 space-y-1 text-[13px] text-muted-foreground">
                          {sesion && (
                            <li className="flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5 text-primary" aria-hidden="true" />{etiquetaJornada(sesion)}</li>
                          )}
                          {a.targetAudienceNote && (
                            <li className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-primary" aria-hidden="true" />{a.targetAudienceNote}</li>
                          )}
                          {a.responsibleLabel && (
                            <li className="flex items-center gap-1.5"><Users2 className="h-3.5 w-3.5 text-primary" aria-hidden="true" />Responsable: {a.responsibleLabel}</li>
                          )}
                        </ul>
                      </div>
                      <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold", a.status === "CLOSED" ? "bg-muted text-muted-foreground" : "bg-success/12 text-success")}>
                        {a.status === "CLOSED" ? "Cerrada" : "Abierta"}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={qr} alt={`Código QR de registro: ${a.title}`} className="h-36 w-36 rounded-xl border border-border/60 bg-white p-1" />
                      <div className="min-w-0 flex-1 space-y-2">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Enlace de registro (nombre y cargo)</p>
                        <p className="break-all rounded-lg bg-muted/60 px-2.5 py-1.5 font-mono text-[11.5px] text-foreground">{enlace}</p>
                        <div className="flex flex-wrap gap-2">
                          <BotonCopiar texto={enlace} />
                          <a href={qr} download={`QR ${a.title}.png`} className={cn(buttonVariants({ size: "sm", variant: "outline" }), "gap-1.5")}>
                            <Download className="h-3.5 w-3.5" aria-hidden="true" /> Descargar QR
                          </a>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3">
                      <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
                        <ClipboardList className="h-4 w-4 text-primary" aria-hidden="true" />
                        {a._count.externalParticipants} {a._count.externalParticipants === 1 ? "persona registrada" : "personas registradas"}
                      </span>
                      <div className="flex flex-wrap gap-2">
                        <Link href={`/sala/${a.id}`} target="_blank" className={cn(buttonVariants({ size: "sm", variant: "outline" }), "gap-1.5")}>
                          <Video className="h-3.5 w-3.5" aria-hidden="true" /> Sala (anfitrión) <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </Link>
                        <Link href={`/admin/planes-capacitacion/${r.id}/actividades/${a.id}`} className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}>
                          Gestión y asistencia
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
