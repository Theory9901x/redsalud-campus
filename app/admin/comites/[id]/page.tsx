import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarClock,
  Check,
  ClipboardList,
  ExternalLink,
  FileText,
  Gavel,
  Info,
  MapPin,
  PhoneCall,
  QrCode,
  ScrollText,
  Timer,
  Users2,
  Video,
} from "lucide-react";
import { requireTutorOrAdmin } from "@/lib/auth-helpers";
import { getComiteDetalle, getAsistenciaComite, ROL_COMITE } from "@/lib/comites";
import { getCallConnectionSummaryForPlan } from "@/lib/call-connections";
import {
  actualizarComiteAction,
  subirDocumentoComiteAction,
  agregarIntegranteAction,
  quitarIntegranteAction,
  crearReunionAction,
  eliminarReunionAction,
} from "@/app/admin/comites/actions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FormularioInformacionComite,
  FormularioDocumentoComite,
  FormularioIntegrante,
  FormularioReunion,
  BotonQuitar,
  BotonCopiar,
} from "@/components/comites/formularios";
import { TrainingDocumentList } from "@/components/training-plans/training-document-list";
import { etiquetaFecha, etiquetaHora, TRAINING_ACTIVITY_STATUS_LABELS } from "@/components/training-plans/labels";
import { cn } from "@/lib/utils";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function iniciales(nombre: string) {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * HUB DE UN COMITÉ: información general con la resolución, integrantes por
 * zona, reuniones con enlace y QR de la sala, y asistencia de los
 * integrantes por reunión. Gestión y medición aparte de los planes.
 */
export default async function ComiteDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireTutorOrAdmin();
  const comite = await getComiteDetalle(id);
  if (!comite) notFound();

  const [asistencia, conexiones] = await Promise.all([getAsistenciaComite(id), getCallConnectionSummaryForPlan(id, null)]);

  // QR de la sala de cada reunión (pocas por comité: se generan aquí).
  const reuniones = await Promise.all(
    comite.activities.map(async (a) => {
      const urlSala = `${APP_URL}/c/${a.id}/meet`;
      const urlInvitados = `${APP_URL}/invitado/${a.id}`;
      const qr = await QRCode.toDataURL(urlSala, { width: 240, margin: 1 });
      const stats = asistencia.porReunion.find((r) => r.activityId === a.id);
      return { ...a, urlSala, urlInvitados, qr, stats };
    })
  );

  const proxima = reuniones
    .flatMap((r) => r.sessions.map((s) => ({ r, s })))
    .filter(({ s }) => s.startsAt.getTime() >= Date.now())
    .sort((a, b) => a.s.startsAt.getTime() - b.s.startsAt.getTime())[0];

  const porRol = {
    empleador: comite.members.filter((m) => ROL_COMITE[m.role].lado === "empleador").length,
    trabajadores: comite.members.filter((m) => ROL_COMITE[m.role].lado === "trabajadores").length,
  };

  const actualizar = actualizarComiteAction.bind(null, id);
  const subirDocumento = subirDocumentoComiteAction.bind(null, id);
  const agregarIntegrante = agregarIntegranteAction.bind(null, id);
  const crearReunion = crearReunionAction.bind(null, id);

  const kpis = [
    { etiqueta: "Integrantes", valor: String(comite.members.length), detalle: `${porRol.empleador} empleador · ${porRol.trabajadores} trabajadores`, Icono: Users2 },
    { etiqueta: "Reuniones", valor: String(comite.activities.length), detalle: proxima ? `Próxima: ${etiquetaFecha(proxima.s.startsAt)}` : "Sin próxima agendada", Icono: CalendarClock },
    { etiqueta: "Asistencia de integrantes", valor: asistencia.promedio === null ? "—" : `${asistencia.promedio}%`, detalle: `${asistencia.integrantesConCuenta} de ${asistencia.integrantes} con cuenta`, Icono: Check },
    { etiqueta: "Tiempo en sala", valor: conexiones.duracionTotalMin >= 60 ? `${Math.floor(conexiones.duracionTotalMin / 60)} h ${conexiones.duracionTotalMin % 60} min` : `${conexiones.duracionTotalMin} min`, detalle: `${conexiones.personasDistintas} personas · ${conexiones.totalTramos} conexiones`, Icono: PhoneCall },
  ];

  return (
    <div className="space-y-6">
      <Link href="/admin/comites" className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Comités
      </Link>

      {/* ---------------- Héroe ---------------- */}
      <section className="comite-hero p-6 sm:p-8">
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.2em] text-white/70">
              <Gavel className="h-4 w-4" aria-hidden="true" />
              Comité institucional {comite.periodLabel ? `· vigencia ${comite.periodLabel}` : ""}
            </p>
            <h1 className="mt-3 font-display text-[clamp(1.7rem,3.6vw,2.4rem)] font-extrabold leading-[1.1] tracking-tight">{comite.title}</h1>
            <div className="mt-4 flex flex-wrap gap-2">
              {comite.resolutionNumber && (
                <span className="comite-vidrio inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-semibold">
                  <ScrollText className="h-3.5 w-3.5" aria-hidden="true" />
                  Resolución {comite.resolutionNumber}
                  {comite.resolutionDate ? ` · ${etiquetaFecha(comite.resolutionDate)}` : ""}
                </span>
              )}
              <span className="comite-vidrio inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-semibold">
                <Users2 className="h-3.5 w-3.5" aria-hidden="true" />
                {comite.porZona.length} {comite.porZona.length === 1 ? "zona" : "zonas"}
              </span>
              <span className="comite-vidrio inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-semibold">
                <Info className="h-3.5 w-3.5" aria-hidden="true" />
                Responsable: {comite.tutor.fullName}
              </span>
            </div>
          </div>
          {proxima && (
            <div className="comite-vidrio min-w-[260px] p-4">
              <p className="text-[10.5px] font-extrabold uppercase tracking-[0.18em] text-white/70">Próxima reunión</p>
              <p className="mt-1.5 font-display text-[1.1rem] font-extrabold leading-tight">{proxima.r.title}</p>
              <p className="mt-1 text-[13px] text-white/85">
                {etiquetaFecha(proxima.s.startsAt)} · {etiquetaHora(proxima.s.startsAt)}
              </p>
              <Link href={`/sala/${proxima.r.id}`} className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-[12.5px] font-bold text-[#0f2438] transition-transform hover:-translate-y-px">
                <Video className="h-4 w-4" aria-hidden="true" />
                Entrar a la sala
              </Link>
            </div>
          )}
        </div>

        <div className="relative mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {kpis.map((k) => (
            <div key={k.etiqueta} className="comite-vidrio p-4">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-white/15">
                <k.Icono className="h-4 w-4" aria-hidden="true" />
              </span>
              <p className="mt-3 font-display text-[1.7rem] font-extrabold leading-none tabular-nums">{k.valor}</p>
              <p className="mt-1 text-[12px] font-semibold text-white/85">{k.etiqueta}</p>
              <p className="text-[11px] text-white/60">{k.detalle}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- Pestañas ---------------- */}
      <Tabs defaultValue="informacion">
        <TabsList>
          <TabsTrigger value="informacion">Información general</TabsTrigger>
          <TabsTrigger value="integrantes">Integrantes</TabsTrigger>
          <TabsTrigger value="reuniones">Reuniones</TabsTrigger>
          <TabsTrigger value="asistencia">Asistencia</TabsTrigger>
        </TabsList>

        {/* ===== Información ===== */}
        <TabsContent value="informacion" className="space-y-5 pt-4">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <div className="comite-tarjeta p-6 lg:col-span-2">
              <h2 className="flex items-center gap-2 font-display text-[15px] font-bold text-foreground">
                <Info className="h-4 w-4 text-primary" aria-hidden="true" />
                Conformación y alcance
              </h2>
              <p className="mt-3 text-[14px] leading-relaxed text-foreground/85">{comite.summary ?? "Sin resumen todavía. Edítalo más abajo."}</p>

              {comite.funciones.length > 0 && (
                <>
                  <h3 className="mt-6 flex items-center gap-2 font-display text-[14px] font-bold text-foreground">
                    <ClipboardList className="h-4 w-4 text-primary" aria-hidden="true" />
                    Funciones del comité y plazos
                  </h3>
                  <ol className="mt-3 space-y-2.5">
                    {comite.funciones.map((f) => (
                      <li key={f.n} className="flex gap-3 rounded-2xl border border-border/50 bg-card/60 p-3.5">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/12 text-[12px] font-extrabold text-primary">{f.n}</span>
                        <div className="min-w-0">
                          <p className="text-[13.5px] leading-snug text-foreground">{f.texto}</p>
                          {f.plazo && (
                            <p className="mt-1 inline-flex items-center gap-1 rounded-md bg-warning/15 px-2 py-0.5 text-[11px] font-bold text-warning-foreground">
                              <Timer className="h-3 w-3" aria-hidden="true" />
                              {f.plazo}
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </div>

            <div className="space-y-5">
              <div className="comite-tarjeta p-6">
                <h2 className="flex items-center gap-2 font-display text-[15px] font-bold text-foreground">
                  <FileText className="h-4 w-4 text-primary" aria-hidden="true" />
                  Resolución y documentos
                </h2>
                <div className="mt-3">
                  <TrainingDocumentList documents={comite.documents} />
                </div>
                <div className="mt-4 border-t border-border/50 pt-4">
                  <FormularioDocumentoComite action={subirDocumento} />
                </div>
              </div>
              <div className="comite-tarjeta p-6">
                <h2 className="font-display text-[15px] font-bold text-foreground">Reglas de sesión</h2>
                <ul className="mt-3 space-y-2 text-[13px] text-muted-foreground">
                  <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />Reunión ordinaria mensual; quórum de la mitad más uno.</li>
                  <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />Extraordinaria cada vez que se recibe una queja.</li>
                  <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />Presidente y secretario elegidos entre los integrantes.</li>
                  <li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />Procedimiento preventivo: máximo 65 días calendario.</li>
                </ul>
              </div>
            </div>
          </div>

          <details className="comite-tarjeta p-6">
            <summary className="cursor-pointer font-display text-[14px] font-bold text-foreground">Editar información general</summary>
            <div className="mt-4">
              <FormularioInformacionComite
                action={actualizar}
                valores={{
                  title: comite.title,
                  resolutionNumber: comite.resolutionNumber ?? "",
                  resolutionDate: comite.resolutionDate ? comite.resolutionDate.toISOString().slice(0, 10) : "",
                  periodLabel: comite.periodLabel ?? "",
                  summary: comite.summary ?? "",
                  functions: comite.funciones.map((f) => `${f.texto} | ${f.plazo}`).join("\n"),
                }}
              />
            </div>
          </details>
        </TabsContent>

        {/* ===== Integrantes ===== */}
        <TabsContent value="integrantes" className="space-y-5 pt-4">
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-5">
              {comite.porZona.length === 0 && (
                <p className="comite-tarjeta p-6 text-sm text-muted-foreground">Todavía no hay integrantes. Agrégalos por documento a la derecha.</p>
              )}
              {comite.porZona.map(({ zona, integrantes }) => (
                <section key={zona} className="comite-zona p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="flex items-center gap-2 font-display text-[15px] font-bold text-foreground">
                      <MapPin className="h-4 w-4 text-primary" aria-hidden="true" />
                      {zona}
                    </h2>
                    <span className="rounded-full bg-primary/12 px-2.5 py-0.5 text-[12px] font-extrabold tabular-nums text-primary">{integrantes.length}</span>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                    {integrantes.map((m) => {
                      const rol = ROL_COMITE[m.role];
                      return (
                        <div key={m.id} className="flex items-start gap-3 rounded-2xl border border-border/50 bg-card/70 p-3.5">
                          <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-full text-[13px] font-extrabold text-white", rol.lado === "empleador" ? "bg-gradient-to-br from-primary to-teal-400" : "bg-gradient-to-br from-success to-emerald-400")}>
                            {iniciales(m.fullName)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[14px] font-bold text-foreground">{m.fullName}</p>
                            <p className="truncate text-[12px] text-muted-foreground">
                              {m.position ?? "—"} · CC {m.documentNumber}
                            </p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              <span className={cn("rounded-md px-2 py-0.5 text-[10.5px] font-bold", rol.lado === "empleador" ? "bg-primary/12 text-primary" : "bg-success/15 text-success")}>{rol.corto}</span>
                              {m.user ? (
                                <span className="rounded-md bg-muted px-2 py-0.5 text-[10.5px] font-semibold text-muted-foreground">
                                  {m.user.lastLoginAt ? "Cuenta activa" : "Cuenta sin ingresar"}
                                </span>
                              ) : (
                                <span className="rounded-md bg-warning/15 px-2 py-0.5 text-[10.5px] font-bold text-warning-foreground">Sin cuenta</span>
                              )}
                            </div>
                          </div>
                          <BotonQuitar onQuitar={quitarIntegranteAction.bind(null, id, m.id)} />
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
            <div className="comite-tarjeta h-fit p-6 xl:sticky xl:top-6">
              <h2 className="font-display text-[15px] font-bold text-foreground">Agregar integrante</h2>
              <p className="mt-1 text-[12px] text-muted-foreground">Por documento: si tiene cuenta se vincula automáticamente.</p>
              <div className="mt-4">
                <FormularioIntegrante action={agregarIntegrante} />
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ===== Reuniones ===== */}
        <TabsContent value="reuniones" className="space-y-5 pt-4">
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="space-y-4">
              {reuniones.length === 0 && <p className="comite-tarjeta p-6 text-sm text-muted-foreground">Sin reuniones todavía. Convoca la primera a la derecha.</p>}
              {reuniones.map((r) => {
                const sesion = r.sessions[0];
                const abierta = r.status === "OPEN";
                return (
                  <article key={r.id} className="comite-tarjeta p-5">
                    <div className="flex flex-col gap-5 md:flex-row">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-display text-[16px] font-extrabold text-foreground">{r.title}</h3>
                          <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-bold", abierta ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")}>
                            {TRAINING_ACTIVITY_STATUS_LABELS[r.status]}
                          </span>
                        </div>
                        <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarClock className="h-4 w-4 text-primary" aria-hidden="true" />
                            {sesion ? `${etiquetaFecha(sesion.startsAt)} · ${etiquetaHora(sesion.startsAt)}${sesion.endsAt ? ` – ${etiquetaHora(sesion.endsAt)}` : ""}` : r.startDate ? etiquetaFecha(r.startDate) : "Sin fecha"}
                          </span>
                          {sesion?.location && (
                            <span className="inline-flex items-center gap-1.5">
                              <MapPin className="h-4 w-4 text-primary" aria-hidden="true" />
                              {sesion.location}
                            </span>
                          )}
                        </p>
                        {r.objective && <p className="mt-2 text-[13px] leading-relaxed text-foreground/80">{r.objective}</p>}

                        {r.stats && (
                          <div className="mt-4 grid grid-cols-3 gap-2">
                            <div className="rounded-xl bg-card/70 p-3">
                              <p className="font-display text-[1.3rem] font-extrabold leading-none tabular-nums text-foreground">{r.stats.porcentaje === null ? "—" : `${r.stats.porcentaje}%`}</p>
                              <p className="mt-1 text-[11px] text-muted-foreground">Asistencia de integrantes</p>
                            </div>
                            <div className="rounded-xl bg-card/70 p-3">
                              <p className="font-display text-[1.3rem] font-extrabold leading-none tabular-nums text-foreground">{r.stats.asistieron}<span className="text-[12px] text-muted-foreground">/{r.stats.total}</span></p>
                              <p className="mt-1 text-[11px] text-muted-foreground">Asistieron</p>
                            </div>
                            <div className="rounded-xl bg-card/70 p-3">
                              <p className="font-display text-[1.3rem] font-extrabold leading-none tabular-nums text-foreground">{r.stats.conectados}</p>
                              <p className="mt-1 text-[11px] text-muted-foreground">Conectados · {r.stats.minutosConectados} min</p>
                            </div>
                          </div>
                        )}

                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <Link href={`/sala/${r.id}`} className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-primary to-teal-400 px-3.5 py-2 text-[12.5px] font-bold text-white shadow-md shadow-primary/25">
                            <Video className="h-4 w-4" aria-hidden="true" />
                            Sala virtual
                          </Link>
                          <BotonCopiar texto={r.urlSala} etiqueta="Copiar enlace" />
                          <BotonCopiar texto={r.urlInvitados} etiqueta="Enlace invitados" />
                          <Link href={`/admin/planes-capacitacion/${id}/actividades/${r.id}`} className="inline-flex items-center gap-1 rounded-xl border border-border/60 bg-card/70 px-3 py-2 text-[12.5px] font-bold text-foreground transition-colors hover:border-primary/40">
                            Gestión completa <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                          </Link>
                          <BotonQuitar onQuitar={eliminarReunionAction.bind(null, id, r.id)} etiqueta="Eliminar reunión" />
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-col items-center rounded-2xl border border-border/50 bg-white p-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={r.qr} alt={`QR de la sala de ${r.title}`} className="h-36 w-36" />
                        <p className="mt-1.5 inline-flex items-center gap-1 text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-[#0f2438]">
                          <QrCode className="h-3 w-3" aria-hidden="true" />
                          Escanear para entrar
                        </p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
            <div className="comite-tarjeta h-fit p-6 xl:sticky xl:top-6">
              <h2 className="font-display text-[15px] font-bold text-foreground">Convocar reunión</h2>
              <p className="mt-1 text-[12px] text-muted-foreground">Crea la reunión y su jornada. Virtual usa la sala integrada: registra asistencia y conexiones sola.</p>
              <div className="mt-4">
                <FormularioReunion action={crearReunion} />
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ===== Asistencia ===== */}
        <TabsContent value="asistencia" className="space-y-5 pt-4">
          <div className="comite-tarjeta overflow-x-auto p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-6">
              <div>
                <h2 className="font-display text-[15px] font-bold text-foreground">Asistencia de integrantes por reunión</h2>
                <p className="mt-1 text-[12.5px] text-muted-foreground">
                  ✓ asistencia en firme · ◐ solo se conectó a la sala · — sin registro. Integrantes sin cuenta no se pueden medir.
                </p>
              </div>
              <span className="rounded-full bg-primary/12 px-3 py-1 text-[12.5px] font-bold text-primary">
                Promedio: {asistencia.promedio === null ? "—" : `${asistencia.promedio}%`}
              </span>
            </div>
            {asistencia.porReunion.length === 0 ? (
              <p className="px-6 pb-6 pt-4 text-sm text-muted-foreground">Sin reuniones todavía.</p>
            ) : (
              <table className="mt-4 w-full min-w-[720px] border-collapse text-[13px]">
                <thead>
                  <tr className="border-y border-border/60 bg-muted/40">
                    <th className="px-5 py-3 text-left text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">Integrante</th>
                    <th className="px-3 py-3 text-left text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">Zona</th>
                    {asistencia.porReunion.map((r) => (
                      <th key={r.activityId} className="px-3 py-3 text-center text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">
                        <span className="block max-w-[140px] truncate">{r.titulo}</span>
                        <span className="block font-semibold normal-case tracking-normal">{r.fecha ? etiquetaFecha(r.fecha) : "—"}</span>
                        <span className={cn("mt-1 inline-block rounded-md px-1.5 py-0.5 text-[10.5px] font-bold normal-case tracking-normal", r.porcentaje === null ? "bg-muted text-muted-foreground" : r.porcentaje >= 85 ? "bg-success/15 text-success" : r.porcentaje >= 70 ? "bg-warning/18 text-warning-foreground" : "bg-destructive/10 text-destructive")}>
                          {r.porcentaje === null ? "sin datos" : `${r.porcentaje}% · ${r.asistieron}/${r.total}`}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {asistencia.matriz.map((m) => (
                    <tr key={m.memberId} className="hover:bg-primary/[0.04]">
                      <td className="px-5 py-2.5 font-semibold text-foreground">
                        {m.nombre}
                        {!m.conCuenta && <span className="ml-2 rounded-md bg-warning/15 px-1.5 py-0.5 text-[10px] font-bold text-warning-foreground">sin cuenta</span>}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">{m.zona}</td>
                      {m.asistencias.map((asistio, i) => (
                        <td key={i} className="px-3 py-2.5 text-center">
                          {asistio ? (
                            <span className="inline-grid h-6 w-6 place-items-center rounded-full bg-success/15 text-success"><Check className="h-3.5 w-3.5" strokeWidth={3} /></span>
                          ) : m.conexiones[i] ? (
                            <span className="inline-grid h-6 w-6 place-items-center rounded-full bg-primary/12 text-[12px] font-bold text-primary" title="Se conectó a la sala">◐</span>
                          ) : (
                            <span className="text-muted-foreground/60">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <Link href={`/admin/planes-capacitacion/${id}/conexiones`} className="inline-flex items-center gap-1.5 text-[13px] font-bold text-primary hover:underline">
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            Ver trazabilidad completa de conexiones a la sala
          </Link>
        </TabsContent>
      </Tabs>
    </div>
  );
}
