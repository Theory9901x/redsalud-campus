import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { ArrowLeft, CalendarClock, ExternalLink, FileCheck2, FileDown, ListOrdered, MapPin, Pencil, Presentation, Target, Users2, Video } from "lucide-react";
import { requireTutorOrAdmin } from "@/lib/auth-helpers";
import { getReunion } from "@/lib/reuniones";
import { agregarSesionAction } from "@/app/admin/reuniones/actions";
import { ModuloHero } from "@/components/training-plans/modulo-hero";
import { PanelDeslizable } from "@/components/training-plans/panel-deslizable";
import { PildoraEstado, escalon } from "@/components/training-plans/plan-visual";
import { SeccionActividad } from "@/components/training-plans/vista-actividad";
import { etiquetaJornada } from "@/components/training-plans/labels";
import { AccesosJornada } from "@/components/training-plans/accesos-jornada";
import { accesosDeJornada } from "@/lib/jornadas";
import { FormularioAgregarSesion } from "@/components/reuniones/formularios";
import { EmptyState } from "@/components/brand/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const ESTADO = { DRAFT: "Borrador", OPEN: "Abierta", CLOSED: "Cerrada" } as const;

export default async function ReunionPage({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await requireTutorOrAdmin();
  const basePath = sesion.user.role === "TUTOR" ? "/tutor/reuniones" : "/admin/reuniones";
  const { id } = await params;
  const r = await getReunion(id);
  if (!r) notFound();

  const accesos = await Promise.all(r.sesiones.map(async (s) => {
    const enlaces = accesosDeJornada(APP_URL, s.id, s.tokenPublico ?? '', { conEvaluacion: false, modalidad: 'VIRTUAL', audience: s.audience })
      .filter((a) => a.clave === 'sala' || a.clave === 'invitados');
    return Promise.all(enlaces.map(async (a) => ({ ...a, qrDataUrl: await QRCode.toDataURL(a.url, { width: 600, margin: 2, errorCorrectionLevel: 'M' }) })));
  }));
  const registrados = r.sesiones.reduce((t, s) => t + s.registrados, 0);
  const actas = r.sesiones.filter((s) => s.actaFirmada).length;

  return (
    <div className="space-y-6">
      <Link href={basePath} className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Reuniones
      </Link>

      <ModuloHero
        eyebrow="Reunión abierta"
        Icono={Presentation}
        titulo={r.titulo}
        descripcion={
          <span className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.06] px-2.5 py-1 text-[12.5px] text-white/85">
              <Users2 className="h-3.5 w-3.5" aria-hidden="true" /> Responsable: {r.responsable}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.06] px-2.5 py-1 text-[12.5px] text-white/85">
              <Video className="h-3.5 w-3.5" aria-hidden="true" /> Anfitrión en la sala: {r.anfitrion.fullName}
            </span>
          </span>
        }
        cifras={[
          { valor: r.sesiones.length, etiqueta: "Sesiones" },
          { valor: r.sesiones.filter((s) => s.estado !== "CLOSED").length, etiqueta: "Abiertas" },
          { valor: registrados, etiqueta: "Asistentes registrados" },
          { valor: `${actas}/${r.sesiones.length}`, etiqueta: "Actas firmadas" },
        ]}
        acciones={
          <PanelDeslizable centrado etiqueta="Agregar sesión" icono="agendar" titulo="Agregar sesión" descripcion="Cada sesión nueva tiene su propio enlace, QR, sala y acta.">
            <FormularioAgregarSesion action={agregarSesionAction.bind(null, r.id)} />
          </PanelDeslizable>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="barra-modulo p-5">
          <h2 className="mono-label flex items-center gap-1.5"><Target className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> Objetivo</h2>
          <p className={cn("mt-2 text-[13.5px] leading-relaxed", r.objetivo ? "text-foreground" : "italic text-muted-foreground")}>{r.objetivo || "Sin objetivo registrado: se completa desde el acta de cada sesión."}</p>
        </section>
        <section className="barra-modulo p-5">
          <h2 className="mono-label flex items-center gap-1.5"><ListOrdered className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> Orden del día</h2>
          {r.ordenDelDia.length === 0 ? (
            <p className="mt-2 text-[13.5px] italic text-muted-foreground">Sin orden del día: se completa desde el acta de cualquier sesión.</p>
          ) : (
            <ol className="mt-2 space-y-1.5">
              {r.ordenDelDia.map((p, i) => (
                <li key={i} className="flex gap-2.5 text-[13.5px] text-foreground">
                  <span className="font-mono text-[12px] font-semibold text-primary">{String(i + 1).padStart(2, "0")}</span>
                  {p.replace(/^\d+[.)]\s*/, "")}
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <SeccionActividad titulo="Sesiones" bajada="Comparte el enlace o el QR de cada sesión: la gente se registra con nombre y cargo y entra a la sala. La asistencia y la permanencia quedan solas.">
        {r.sesiones.length === 0 ? (
          <EmptyState icon={CalendarClock} title="Sin sesiones" description="Agrega la primera con «Agregar sesión»." className="py-12" />
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {r.sesiones.map((s, i) => {
              return (
                <article key={s.id} className="plan-instancia revelar flex flex-col gap-4 p-5" style={escalon(i)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="mono-label">Sesión {String(i + 1).padStart(2, "0")}</p>
                      <h3 className="mt-1 font-display text-[1.02rem] font-bold leading-snug text-foreground">{s.titulo.replace(`${r.titulo} · `, "")}</h3>
                      <div className="mt-2 flex flex-wrap gap-2 text-[12px]">
                        {s.inicio && <span className="chip-dato"><CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />{etiquetaJornada({ startsAt: s.inicio, endsAt: s.fin })}</span>}
                        {s.dirigidoA && <span className="chip-dato"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />{s.dirigidoA}</span>}
                      </div>
                    </div>
                    <PildoraEstado estado={s.estado}>{ESTADO[s.estado]}</PildoraEstado>
                  </div>

                  <AccesosJornada accesos={accesos[i]} abiertoInicial />

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3">
                    <div className="flex flex-wrap gap-3 text-[12.5px]">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                        <Users2 className="h-4 w-4 text-primary" aria-hidden="true" />{s.registrados} registrados
                      </span>
                      <span className={cn("inline-flex items-center gap-1.5 font-semibold", s.actaFirmada ? "text-success" : "text-muted-foreground")}>
                        <FileCheck2 className="h-4 w-4" aria-hidden="true" />{s.actaFirmada ? "Acta firmada" : "Acta pendiente"}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/sala/${s.id}`} target="_blank" className={cn(buttonVariants({ size: "sm", variant: "outline" }), "gap-1.5")}>
                        <Video className="h-3.5 w-3.5" aria-hidden="true" /> Sala <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      </Link>
                      <a href={`/api/reuniones/${r.id}/sesiones/${s.id}/acta`} className={cn(buttonVariants({ size: "sm", variant: "outline" }), "gap-1.5")}>
                        <FileDown className="h-3.5 w-3.5" aria-hidden="true" /> Acta PDF
                      </a>
                      <Link href={`${basePath}/${r.id}/sesiones/${s.id}?editar=1`} className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}>
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Editar
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </SeccionActividad>
    </div>
  );
}
