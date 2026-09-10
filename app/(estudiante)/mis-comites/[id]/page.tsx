import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { ArrowLeft, ArrowUpRight, CalendarClock, ClipboardList, ExternalLink, FileText, Gavel, Info, MapPin, QrCode, ScrollText, Timer, Users2, Video } from "lucide-react";
import { requireSession } from "@/lib/auth-helpers";
import { esIntegranteDe, getComiteDetalle, ROL_COMITE } from "@/lib/comites";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { etiquetaFecha, etiquetaHora, TRAINING_ACTIVITY_STATUS_LABELS } from "@/components/training-plans/labels";
import { BotonCopiar } from "@/components/comites/formularios";
import { cn } from "@/lib/utils";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function iniciales(nombre: string) {
  return nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

/**
 * Vista del comité para SUS INTEGRANTES (solo lectura): información
 * general y resolución, integrantes por zona, reuniones con el enlace
 * visible, el QR y el botón para entrar a la sala.
 */
export default async function MiComitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession(`/mis-comites/${id}`);
  const esGestor = session.user.role === "ADMIN" || session.user.role === "TUTOR";
  if (!esGestor && !(await esIntegranteDe(session.user.id, id))) notFound();

  const comite = await getComiteDetalle(id);
  if (!comite) notFound();
  const yo = comite.members.find((m) => m.userId === session.user.id);

  const reuniones = await Promise.all(
    comite.activities.map(async (a) => ({
      ...a,
      urlSala: `${APP_URL}/c/${a.id}/meet`,
      qr: await QRCode.toDataURL(`${APP_URL}/c/${a.id}/meet`, { width: 220, margin: 1 }),
    }))
  );
  const ahora = Date.now();
  const proximas = reuniones.filter((r) => r.status !== "CLOSED" && (r.sessions[0]?.startsAt.getTime() ?? 0) + 4 * 3600e3 >= ahora);
  const pasadas = reuniones.filter((r) => !proximas.includes(r));

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <Link href="/mis-comites" className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Mis comités
      </Link>

      <section className="comite-hero p-6 sm:p-8">
        <div className="relative">
          <p className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.2em] text-white/70">
            <Gavel className="h-4 w-4" aria-hidden="true" />
            Comité institucional {comite.periodLabel ? `· vigencia ${comite.periodLabel}` : ""}
          </p>
          <h1 className="mt-3 font-display text-[clamp(1.6rem,3.4vw,2.3rem)] font-extrabold leading-[1.1] tracking-tight">{comite.title}</h1>
          <div className="mt-4 flex flex-wrap gap-2">
            {comite.resolutionNumber && (
              <span className="comite-vidrio inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-semibold">
                <ScrollText className="h-3.5 w-3.5" aria-hidden="true" />
                Resolución {comite.resolutionNumber}{comite.resolutionDate ? ` · ${etiquetaFecha(comite.resolutionDate)}` : ""}
              </span>
            )}
            {yo && (
              <span className="comite-vidrio inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-semibold">
                <Users2 className="h-3.5 w-3.5" aria-hidden="true" />
                Tu rol: {ROL_COMITE[yo.role].etiqueta} · {yo.zone}
              </span>
            )}
          </div>
          {proximas[0] && (
            <div className="comite-vidrio mt-6 flex flex-wrap items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="text-[10.5px] font-extrabold uppercase tracking-[0.16em] text-white/70">Próxima reunión</p>
                <p className="mt-1 font-display text-[1.1rem] font-extrabold">{proximas[0].title}</p>
                <p className="text-[13px] text-white/85">
                  {proximas[0].sessions[0] ? `${etiquetaFecha(proximas[0].sessions[0].startsAt)} · ${etiquetaHora(proximas[0].sessions[0].startsAt)}` : "Fecha por confirmar"}
                </p>
                <p className="mt-1 break-all font-mono text-[12px] text-white/80">{proximas[0].urlSala}</p>
              </div>
              <Link href={`/sala/${proximas[0].id}`} className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-[13.5px] font-bold text-[#0f2438] shadow-lg">
                <Video className="h-4 w-4" aria-hidden="true" />
                Entrar a la reunión
              </Link>
            </div>
          )}
        </div>
      </section>

      <Tabs defaultValue="reuniones">
        <TabsList>
          <TabsTrigger value="reuniones">Reuniones</TabsTrigger>
          <TabsTrigger value="informacion">Información general</TabsTrigger>
          <TabsTrigger value="integrantes">Integrantes</TabsTrigger>
        </TabsList>

        <TabsContent value="reuniones" className="space-y-4 pt-4">
          {reuniones.length === 0 && <p className="comite-tarjeta p-6 text-sm text-muted-foreground">Todavía no hay reuniones convocadas.</p>}
          {[...proximas, ...pasadas].map((r) => {
            const s = r.sessions[0];
            const abierta = r.status !== "CLOSED";
            return (
              <article key={r.id} className="comite-tarjeta p-5">
                <div className="flex flex-col gap-5 md:flex-row">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-[16px] font-extrabold text-foreground">{r.title}</h3>
                      <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-bold", abierta ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")}>{TRAINING_ACTIVITY_STATUS_LABELS[r.status]}</span>
                    </div>
                    <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5"><CalendarClock className="h-4 w-4 text-primary" aria-hidden="true" />{s ? `${etiquetaFecha(s.startsAt)} · ${etiquetaHora(s.startsAt)}${s.endsAt ? ` – ${etiquetaHora(s.endsAt)}` : ""}` : "Sin fecha"}</span>
                      {s?.location && <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4 text-primary" aria-hidden="true" />{s.location}</span>}
                    </p>
                    {r.objective && <p className="mt-2 text-[13px] leading-relaxed text-foreground/80">{r.objective}</p>}
                    <div className="mt-3 rounded-xl bg-muted/50 px-3 py-2">
                      <p className="text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">Enlace de la sala</p>
                      <p className="break-all font-mono text-[12.5px] font-semibold text-foreground">{r.urlSala}</p>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {abierta && (
                        <Link href={`/sala/${r.id}`} className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-primary to-teal-400 px-4 py-2.5 text-[13px] font-bold text-white shadow-md shadow-primary/25">
                          <Video className="h-4 w-4" aria-hidden="true" />
                          Entrar a la reunión
                        </Link>
                      )}
                      <BotonCopiar texto={r.urlSala} />
                      <Link href={`/mis-comites/${id}/reuniones/${r.id}`} className="inline-flex items-center gap-1 rounded-xl border border-border/60 bg-card/70 px-3 py-2 text-[12.5px] font-bold text-foreground transition-colors hover:border-primary/40">
                        Ver registro de la sesión <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-center self-start rounded-2xl border border-border/50 bg-white p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={r.qr} alt={`QR de ${r.title}`} className="h-36 w-36" />
                    <p className="mt-1.5 inline-flex items-center gap-1 text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-[#0f2438]"><QrCode className="h-3 w-3" aria-hidden="true" />Escanear para entrar</p>
                  </div>
                </div>
              </article>
            );
          })}
        </TabsContent>

        <TabsContent value="informacion" className="space-y-5 pt-4">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <div className="comite-tarjeta p-6 lg:col-span-2">
              <h2 className="flex items-center gap-2 font-display text-[15px] font-bold text-foreground"><Info className="h-4 w-4 text-primary" aria-hidden="true" />Conformación y alcance</h2>
              <p className="mt-3 text-[14px] leading-relaxed text-foreground/85">{comite.summary ?? "—"}</p>
              {comite.funciones.length > 0 && (
                <>
                  <h3 className="mt-6 flex items-center gap-2 font-display text-[14px] font-bold text-foreground"><ClipboardList className="h-4 w-4 text-primary" aria-hidden="true" />Funciones del comité y plazos</h3>
                  <ol className="mt-3 space-y-2.5">
                    {comite.funciones.map((f) => (
                      <li key={f.n} className="flex gap-3 rounded-2xl border border-border/50 bg-card/60 p-3.5">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/12 text-[12px] font-extrabold text-primary">{f.n}</span>
                        <div><p className="text-[13.5px] leading-snug text-foreground">{f.texto}</p>{f.plazo && <p className="mt-1 inline-flex items-center gap-1 rounded-md bg-warning/15 px-2 py-0.5 text-[11px] font-bold text-warning-foreground"><Timer className="h-3 w-3" aria-hidden="true" />{f.plazo}</p>}</div>
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </div>
            <div className="comite-tarjeta h-fit p-6">
              <h2 className="flex items-center gap-2 font-display text-[15px] font-bold text-foreground"><FileText className="h-4 w-4 text-primary" aria-hidden="true" />Resolución y documentos</h2>
              {comite.documents.length === 0 ? (
                <p className="mt-3 text-[13px] text-muted-foreground">Sin documentos.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {comite.documents.map((d) => (
                    <li key={d.id}>
                      <a href={d.fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl border border-border/50 bg-card/70 px-3 py-2.5 text-[13px] font-semibold text-foreground transition-colors hover:border-primary/40">
                        <FileText className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                        <span className="min-w-0 flex-1 truncate">{d.fileName.replace(/^\d+-/, "").replace(/-/g, " ")}</span>
                        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="integrantes" className="space-y-5 pt-4">
          {comite.porZona.map(({ zona, integrantes }) => (
            <section key={zona} className="comite-zona p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 font-display text-[15px] font-bold text-foreground"><MapPin className="h-4 w-4 text-primary" aria-hidden="true" />{zona}</h2>
                <span className="rounded-full bg-primary/12 px-2.5 py-0.5 text-[12px] font-extrabold tabular-nums text-primary">{integrantes.length}</span>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                {integrantes.map((m) => {
                  const rol = ROL_COMITE[m.role];
                  return (
                    <div key={m.id} className={cn("flex items-start gap-3 rounded-2xl border bg-card/70 p-3.5", m.userId === session.user.id ? "border-primary/40" : "border-border/50")}>
                      <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-full text-[13px] font-extrabold text-white", rol.lado === "empleador" ? "bg-gradient-to-br from-primary to-teal-400" : "bg-gradient-to-br from-success to-emerald-400")}>{iniciales(m.fullName)}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-bold text-foreground">{m.fullName}{m.userId === session.user.id ? " (tú)" : ""}</p>
                        <p className="truncate text-[12px] text-muted-foreground">{m.position ?? "—"}</p>
                        <span className={cn("mt-1.5 inline-block rounded-md px-2 py-0.5 text-[10.5px] font-bold", rol.lado === "empleador" ? "bg-primary/12 text-primary" : "bg-success/15 text-success")}>{rol.corto}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
