import Link from "next/link";
import QRCode from "qrcode";
import { CalendarClock, Check, ExternalLink, FileText, FileVideo, MapPin, PhoneCall, QrCode, Timer, Users2, Video } from "lucide-react";
import type { getReunionComite } from "@/lib/comites-reunion";
import { etiquetaFecha, etiquetaHora, TRAINING_ACTIVITY_STATUS_LABELS, TRAINING_MODALITY_LABELS } from "@/components/training-plans/labels";
import { BotonCopiar } from "@/components/comites/formularios";
import { cn } from "@/lib/utils";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

type Reunion = NonNullable<Awaited<ReturnType<typeof getReunionComite>>>;

function Tabla({ columnas, children }: { columnas: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card/70 shadow-sm backdrop-blur-sm">
      <table className="w-full min-w-[760px] border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-border/60 bg-muted/40">
            {columnas.map((c) => (
              <th key={c} className="whitespace-nowrap px-4 py-3 text-left text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">{children}</tbody>
      </table>
    </div>
  );
}

/**
 * FICHA DE UNA REUNIÓN del comité: el registro de esa sesión como base de
 * datos. La misma ficha la ve el administrador (con acciones, que le llegan
 * por `acciones`) y el integrante (solo lectura, con el enlace visible y el
 * botón para entrar).
 */
export async function FichaReunion({ reunion, acciones }: { reunion: Reunion; acciones?: React.ReactNode }) {
  const { actividad, sesion, filas, otros, resumen } = reunion;
  const urlSala = `${APP_URL}/c/${actividad.id}/meet`;
  const urlInvitados = `${APP_URL}/invitado/${actividad.id}`;
  const qr = await QRCode.toDataURL(urlSala, { width: 320, margin: 1 });
  const cerrada = actividad.status === "CLOSED";
  const modalidad = sesion?.modality ?? actividad.modality;

  const kpis = [
    { etiqueta: "Integrantes que asistieron", valor: `${resumen.asistieron}/${resumen.conCuenta}`, detalle: resumen.porcentaje === null ? "sin cuenta vinculada" : `${resumen.porcentaje}% · ${resumen.quorum ? "hay quórum" : "sin quórum"}`, Icono: Users2, color: resumen.quorum ? "text-success" : "text-warning-foreground" },
    { etiqueta: "Conectados a la sala", valor: String(resumen.conectados), detalle: `${resumen.minutosTotales} min acumulados`, Icono: PhoneCall, color: "text-primary" },
    { etiqueta: "Grabaciones", valor: String(resumen.grabaciones), detalle: `${resumen.documentos} documentos en total`, Icono: FileVideo, color: "text-primary" },
    { etiqueta: "Estado", valor: TRAINING_ACTIVITY_STATUS_LABELS[actividad.status], detalle: cerrada ? "informe disponible" : "se cierra al terminar", Icono: Check, color: cerrada ? "text-success" : "text-muted-foreground" },
  ];

  return (
    <div className="space-y-6">
      {/* Cabecera de la sesión */}
      <section className="comite-hero p-6 sm:p-8">
        <div className="relative grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.2em] text-white/70">
              <CalendarClock className="h-4 w-4" aria-hidden="true" />
              Sesión del comité · {TRAINING_MODALITY_LABELS[modalidad]}
            </p>
            <h1 className="mt-2 font-display text-[clamp(1.5rem,3.2vw,2.1rem)] font-extrabold leading-tight tracking-tight">{actividad.title}</h1>
            <div className="mt-3 flex flex-wrap gap-2 text-[13px]">
              <span className="comite-vidrio inline-flex items-center gap-1.5 px-3 py-1.5 font-semibold">
                <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                {sesion ? `${etiquetaFecha(sesion.startsAt)} · ${etiquetaHora(sesion.startsAt)}${sesion.endsAt ? ` – ${etiquetaHora(sesion.endsAt)}` : ""}` : actividad.startDate ? etiquetaFecha(actividad.startDate) : "Sin fecha"}
              </span>
              {sesion?.location && (
                <span className="comite-vidrio inline-flex items-center gap-1.5 px-3 py-1.5 font-semibold">
                  <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                  {sesion.location}
                </span>
              )}
              <span className={cn("comite-vidrio inline-flex items-center gap-1.5 px-3 py-1.5 font-semibold", cerrada && "text-white/70")}>{TRAINING_ACTIVITY_STATUS_LABELS[actividad.status]}</span>
            </div>
            {actividad.objective && <p className="mt-4 max-w-2xl text-[14px] leading-relaxed text-white/85">{actividad.objective}</p>}

            {/* Enlace VISIBLE y acceso directo */}
            <div className="comite-vidrio mt-5 p-4">
              <p className="text-[10.5px] font-extrabold uppercase tracking-[0.16em] text-white/70">Enlace de la sala</p>
              <p className="mt-1 break-all font-mono text-[13.5px] font-semibold">{urlSala}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {!cerrada && (
                  <Link href={`/sala/${actividad.id}`} className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-[13.5px] font-bold text-[#0f2438] shadow-lg transition-transform hover:-translate-y-px">
                    <Video className="h-4 w-4" aria-hidden="true" />
                    Entrar a la reunión
                  </Link>
                )}
                <span className="[&_button]:border-white/25 [&_button]:bg-white/10 [&_button]:text-white">
                  <BotonCopiar texto={urlSala} etiqueta="Copiar enlace" />
                </span>
                <span className="[&_button]:border-white/25 [&_button]:bg-white/10 [&_button]:text-white">
                  <BotonCopiar texto={urlInvitados} etiqueta="Enlace para invitados" />
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center self-start rounded-3xl bg-white p-4 shadow-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="QR de la sala" className="h-44 w-44" />
            <p className="mt-2 inline-flex items-center gap-1 text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-[#0f2438]">
              <QrCode className="h-3 w-3" aria-hidden="true" />
              Escanear para entrar
            </p>
          </div>
        </div>

        <div className="relative mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {kpis.map((k) => (
            <div key={k.etiqueta} className="comite-vidrio p-4">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-white/15">
                <k.Icono className="h-4 w-4" aria-hidden="true" />
              </span>
              <p className="mt-3 font-display text-[1.5rem] font-extrabold leading-none tabular-nums">{k.valor}</p>
              <p className="mt-1 text-[12px] font-semibold text-white/85">{k.etiqueta}</p>
              <p className="text-[11px] text-white/60">{k.detalle}</p>
            </div>
          ))}
        </div>
      </section>

      {acciones}

      {/* Asistencia de integrantes: registro por columnas */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold tracking-tight text-foreground">
          <Users2 className="h-4 w-4 text-primary" aria-hidden="true" />
          Asistencia de integrantes en esta sesión
        </h2>
        <Tabla columnas={["#", "Integrante", "Zona", "Rol", "Asistencia", "Hora", "Conexión a la sala", "Tiempo"]}>
          {filas.map((f, i) => (
            <tr key={f.memberId} className="transition-colors hover:bg-primary/[0.04]">
              <td className="px-4 py-3 tabular-nums text-muted-foreground">{i + 1}</td>
              <td className="px-4 py-3">
                <span className="font-semibold text-foreground">{f.nombre}</span>
                {f.cargo && <span className="block text-[11.5px] text-muted-foreground">{f.cargo}</span>}
                {!f.conCuenta && <span className="mt-0.5 inline-block rounded-md bg-warning/15 px-1.5 py-0.5 text-[10px] font-bold text-warning-foreground">sin cuenta</span>}
              </td>
              <td className="px-4 py-3 text-muted-foreground">{f.zona}</td>
              <td className="px-4 py-3 text-muted-foreground">{f.rol}</td>
              <td className="px-4 py-3">
                {f.asistio ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-success/15 px-2 py-0.5 text-[11px] font-bold text-success"><Check className="h-3 w-3" strokeWidth={3} />Asistió{f.origen === "AUTOMATIC" ? " · sala" : " · manual"}</span>
                ) : (
                  <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">Sin registro</span>
                )}
              </td>
              <td className="whitespace-nowrap px-4 py-3 tabular-nums">{f.horaAsistencia ? etiquetaHora(f.horaAsistencia) : "—"}</td>
              <td className="whitespace-nowrap px-4 py-3 tabular-nums">{f.conectado && f.primerIngreso && f.ultimaSalida ? `${etiquetaHora(f.primerIngreso)} → ${etiquetaHora(f.ultimaSalida)} · ${f.ingresos} ${f.ingresos === 1 ? "ingreso" : "ingresos"}` : "—"}</td>
              <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums">{f.conectado ? `${f.minutos} min` : "—"}</td>
            </tr>
          ))}
        </Tabla>
        {otros.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-[13px] font-bold text-foreground">Otras personas conectadas ({otros.length})</h3>
            <Tabla columnas={["#", "Persona", "Tipo", "Primer ingreso", "Ingresos", "Tiempo"]}>
              {otros.map((o, i) => (
                <tr key={i}>
                  <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-2.5 font-semibold text-foreground">{o.nombre}</td>
                  <td className="px-4 py-2.5"><span className={cn("rounded-md px-2 py-0.5 text-[10.5px] font-bold", o.externo ? "bg-warning/15 text-warning-foreground" : "bg-primary/12 text-primary")}>{o.externo ? "Invitado externo" : "Funcionario"}</span></td>
                  <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">{etiquetaHora(o.primerIngreso)}</td>
                  <td className="px-4 py-2.5 tabular-nums">{o.ingresos}</td>
                  <td className="px-4 py-2.5 font-semibold tabular-nums">{o.minutos} min</td>
                </tr>
              ))}
            </Tabla>
          </div>
        )}
      </section>

      {/* Grabaciones y documentos */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold tracking-tight text-foreground">
          <FileVideo className="h-4 w-4 text-primary" aria-hidden="true" />
          Grabaciones y documentos de la sesión
        </h2>
        {actividad.documents.length === 0 ? (
          <p className="comite-tarjeta p-5 text-sm text-muted-foreground">
            Sin grabaciones todavía. Desde la sala, el botón <b>Grabar jornada</b> guarda el video aquí automáticamente al terminar.
          </p>
        ) : (
          <Tabla columnas={["Archivo", "Tipo", "Tamaño", "Subido", "Por", ""]}>
            {actividad.documents.map((d) => (
              <tr key={d.id}>
                <td className="px-4 py-2.5 font-semibold text-foreground">{d.fileName.replace(/^\d+-/, "")}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{d.fileType.startsWith("video/") ? "Grabación" : "Documento"}</td>
                <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{Math.round(d.fileSize / 1024 / 1024 * 10) / 10} MB</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">{etiquetaFecha(d.createdAt)} · {etiquetaHora(d.createdAt)}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{d.uploader.fullName}</td>
                <td className="px-4 py-2.5 text-right">
                  <a href={d.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12px] font-bold text-primary hover:underline">
                    Abrir <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                </td>
              </tr>
            ))}
          </Tabla>
        )}
      </section>

      <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
        <Timer className="h-3.5 w-3.5" aria-hidden="true" />
        La asistencia queda registrada automáticamente al entrar a la sala; las conexiones se escriben cuando cada persona sale.
        <FileText className="ml-2 h-3.5 w-3.5" aria-hidden="true" />
        El informe PDF se habilita al cerrar la sesión.
      </p>
    </div>
  );
}
