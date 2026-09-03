import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileText,
  MapPin,
  PhoneCall,
  Timer,
  TrendingUp,
  User2,
  UserPlus,
  Users2,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireTrainingActivityAccess } from "@/lib/auth-helpers";
import { getAsistentesSesion, type SnapshotSesion } from "@/lib/sesiones-presenciales";
import { PanelSesionVivo } from "@/components/sesiones/panel-sesion-vivo";
import { TRAINING_MODALITY_LABELS } from "@/components/training-plans/labels";
import { etiquetaHora } from "@/components/training-plans/labels";
import { cn } from "@/lib/utils";

const FORMATO_FECHA = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long" });
const FORMATO_HORA = new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit" });
const FORMATO_HORA_SEG = new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit", second: "2-digit" });

const ESTADO_ENCUESTA: Record<string, { etiqueta: string; clase: string }> = {
  DRAFT: { etiqueta: "Borrador", clase: "bg-muted text-muted-foreground" },
  PUBLISHED: { etiqueta: "Publicada", clase: "bg-success/15 text-success" },
  CLOSED: { etiqueta: "Cerrada", clase: "bg-primary/12 text-primary" },
};

function formatoDuracion(seg: number): string {
  const min = Math.round(seg / 60);
  if (min < 1) return "menos de 1 min";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return `${h} h ${min % 60} min`;
}

/** Cabecera + celdas homogéneas: el registro se lee como base de datos, por columnas. */
function Tabla({ columnas, children }: { columnas: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card/70 shadow-sm backdrop-blur-sm">
      <table className="w-full min-w-[640px] border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-border/60 bg-muted/40">
            {columnas.map((c) => (
              <th key={c} className="whitespace-nowrap px-4 py-3 text-left text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">{children}</tbody>
      </table>
    </div>
  );
}

function Kpi({ Icono, valor, etiqueta, detalle, chip }: { Icono: React.ComponentType<{ className?: string; strokeWidth?: number }>; valor: string; etiqueta: string; detalle?: string; chip: string }) {
  return (
    <div className="surface-vivo">
      <div className="flex h-full flex-col justify-between gap-3 p-5">
        <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", chip)}>
          <Icono className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
        </span>
        <div>
          <p className="font-display text-[1.5rem] font-extrabold leading-none tracking-tight tabular-nums text-foreground">{valor}</p>
          <p className="mt-1.5 text-[12px] leading-tight text-muted-foreground">{etiqueta}</p>
          {detalle && <p className="mt-0.5 text-[11px] font-semibold text-success">{detalle}</p>}
        </div>
      </div>
    </div>
  );
}

/**
 * FASE 10 — Página de gestión de UNA jornada, compartida por tutor y
 * administrador. Presencial: control de fases en vivo (QR, registro manual).
 * Virtual: el registro completo de la llamada -quién se conectó, cuánto
 * estuvo, la asistencia que quedó en firme y las encuestas- en tablas por
 * columnas, porque esta página ES la constancia de la jornada.
 */
export async function PaginaSesionVivo({
  sesionId,
  basePath,
  planId,
  activityId,
}: {
  sesionId: string;
  basePath: string;
  planId: string;
  activityId: string;
}) {
  const sesion = await prisma.trainingSession.findUnique({
    where: { id: sesionId },
    include: {
      activity: { select: { id: true, title: true, status: true, modality: true, area: { select: { name: true } } } },
      municipio: { select: { nombre: true } },
    },
  });
  if (!sesion || sesion.activityId !== activityId) notFound();
  await requireTrainingActivityAccess(sesion.activityId);

  const esVirtual = sesion.modality === "VIRTUAL";
  const asistentes = esVirtual ? [] : await getAsistentesSesion(sesionId);
  const snapshot = sesion.cierreSnapshot as unknown as SnapshotSesion | null;

  // Ventana de la jornada para filtrar el registro: margen amplio a lado y
  // lado porque la gente entra a probar sonido antes y la sesión puede
  // extenderse. Sin hora de fin, se asume la jornada dentro del mismo día.
  const desde = new Date(sesion.startsAt.getTime() - 3 * 3600e3);
  const hasta = sesion.endsAt
    ? new Date(sesion.endsAt.getTime() + 3 * 3600e3)
    : new Date(sesion.startsAt.getTime() + 14 * 3600e3);

  const [tramos, asistenciaVentana, encuestas] = esVirtual
    ? await Promise.all([
        prisma.callConnectionLog.findMany({
          where: { activityId, joinedAt: { gte: desde, lte: hasta } },
          orderBy: { joinedAt: "asc" },
          select: {
            displayName: true,
            joinedAt: true,
            leftAt: true,
            durationSeconds: true,
            userId: true,
            externalParticipantId: true,
            user: { select: { fullName: true, documentNumber: true } },
            externalParticipant: { select: { fullName: true, company: true } },
          },
        }),
        prisma.trainingAttendance.findMany({
          where: { activityId, attended: true, registeredAt: { gte: desde, lte: hasta } },
          orderBy: { registeredAt: "asc" },
          select: {
            registeredAt: true,
            source: true,
            user: { select: { fullName: true, documentNumber: true } },
          },
        }),
        prisma.survey.findMany({
          where: { trainingActivityId: activityId },
          orderBy: { createdAt: "asc" },
          select: { id: true, title: true, status: true, _count: { select: { responses: true } } },
        }),
      ])
    : [[], [], []];

  // Un tramo por entrada/salida; aquí se consolida POR PERSONA: primer
  // ingreso, última salida, minutos sumados y cuántas veces entró.
  type Consolidado = {
    nombre: string;
    documento: string | null;
    empresa: string | null;
    externo: boolean;
    primerIngreso: Date;
    ultimaSalida: Date;
    segundos: number;
    ingresos: number;
  };
  const porPersona = new Map<string, Consolidado>();
  for (const t of tramos) {
    const clave = t.userId ?? (t.externalParticipantId ? `ext:${t.externalParticipantId}` : `nom:${t.displayName}`);
    const previo = porPersona.get(clave);
    if (previo) {
      previo.segundos += t.durationSeconds;
      previo.ingresos += 1;
      if (t.leftAt > previo.ultimaSalida) previo.ultimaSalida = t.leftAt;
    } else {
      porPersona.set(clave, {
        nombre: t.user?.fullName ?? t.externalParticipant?.fullName ?? t.displayName,
        documento: t.user?.documentNumber ?? null,
        empresa: t.externalParticipant?.company ?? null,
        externo: !t.userId,
        primerIngreso: t.joinedAt,
        ultimaSalida: t.leftAt,
        segundos: t.durationSeconds,
        ingresos: 1,
      });
    }
  }
  const conexiones = [...porPersona.values()];
  const totalSegundos = conexiones.reduce((s, c) => s + c.segundos, 0);
  const externosConectados = conexiones.filter((c) => c.externo).length;

  return (
    <div className="space-y-6">
      <Link
        href={`${basePath}/${planId}/actividades/${activityId}`}
        className="flex w-fit items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {sesion.activity.title}
      </Link>

      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
          Jornada {TRAINING_MODALITY_LABELS[sesion.modality].toLowerCase()} · {sesion.activity.area?.name ?? "Capacitación"}
        </p>
        <h1 className="mt-2 font-display text-[clamp(1.5rem,3.2vw,2rem)] font-extrabold leading-tight tracking-tight text-foreground">
          {FORMATO_FECHA.format(sesion.startsAt)}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-4 text-[13px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <CalendarClock className="h-4 w-4 text-primary" />
            {FORMATO_HORA.format(sesion.startsAt)}
            {sesion.endsAt ? ` – ${FORMATO_HORA.format(sesion.endsAt)}` : ""}
          </span>
          {(sesion.location || sesion.municipio) && (
            <span className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-primary" />
              {[sesion.location, sesion.municipio?.nombre].filter(Boolean).join(" · ")}
            </span>
          )}
          {sesion.facilitador && (
            <span className="flex items-center gap-1.5">
              <User2 className="h-4 w-4 text-primary" />
              {sesion.facilitador}
            </span>
          )}
        </div>
      </header>

      {/* Acta congelada, si ya cerró */}
      {snapshot && (
        <section aria-label="Acta de la sesión" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Kpi Icono={Users2} valor={String(snapshot.asistentes)} etiqueta="Asistentes" chip="bg-primary/12 text-primary" />
          <Kpi Icono={CheckCircle2} valor={String(snapshot.presaberPresentados)} etiqueta="Presaber presentados" chip="bg-primary/12 text-primary" />
          <Kpi Icono={CheckCircle2} valor={String(snapshot.postsaberPresentados)} etiqueta="Postsaber presentados" chip="bg-primary/12 text-primary" />
          <Kpi
            Icono={TrendingUp}
            valor={
              snapshot.promedioPre !== null && snapshot.promedioPost !== null
                ? `${snapshot.promedioPre}% → ${snapshot.promedioPost}%`
                : "—"
            }
            etiqueta="Adherencia de la sesión"
            detalle={
              snapshot.diferencia !== null
                ? `${snapshot.diferencia > 0 ? "+" : ""}${snapshot.diferencia} pp${snapshot.variacion !== null ? ` (${snapshot.variacion > 0 ? "+" : ""}${snapshot.variacion}%)` : ""}`
                : undefined
            }
            chip="bg-success/15 text-success"
          />
        </section>
      )}

      {esVirtual ? (
        <>
          {/* -------- Registro de la jornada virtual -------- */}
          <section aria-label="Indicadores de la jornada" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Kpi Icono={PhoneCall} valor={String(conexiones.length)} etiqueta="Personas conectadas a la llamada" chip="bg-primary/12 text-primary" />
            <Kpi Icono={Timer} valor={totalSegundos > 0 ? formatoDuracion(totalSegundos) : "0 min"} etiqueta="Tiempo conectado acumulado" chip="bg-success/15 text-success" />
            <Kpi Icono={Users2} valor={String(asistenciaVentana.length)} etiqueta="Asistencias en firme" chip="bg-primary/12 text-primary" />
            <Kpi Icono={UserPlus} valor={String(externosConectados)} etiqueta="Invitados externos conectados" chip="bg-warning/18 text-warning-foreground" />
          </section>

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold tracking-tight text-foreground">
                <PhoneCall className="h-4 w-4 text-primary" aria-hidden="true" />
                Conexiones a la llamada
              </h2>
              <a
                href={`/api/planes-capacitacion/sesiones/${sesion.id}/csv`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-card/70 px-3.5 py-2 text-[12.5px] font-bold text-foreground transition-colors hover:border-primary/40"
              >
                Exportar corte de la sesión (CSV)
              </a>
            </div>
            {conexiones.length === 0 ? (
              <p className="surface p-4 text-sm text-muted-foreground">
                Nadie se ha conectado a la sala en la franja de esta jornada. Los tramos se registran cuando cada
                persona sale de la llamada o cierra la pestaña.
              </p>
            ) : (
              <Tabla columnas={["#", "Participante", "Documento", "Primer ingreso", "Última salida", "Tiempo conectado", "Ingresos"]}>
                {conexiones.map((c, i) => (
                  <tr key={i} className="transition-colors hover:bg-primary/[0.04]">
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-foreground">{c.nombre}</span>
                      {c.externo && (
                        <span className="ml-2 rounded-md bg-warning/15 px-1.5 py-0.5 text-[10.5px] font-bold text-warning-foreground">
                          Invitado{c.empresa ? ` · ${c.empresa}` : ""}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">{c.documento ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums">{etiquetaHora(c.primerIngreso)}</td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums">{etiquetaHora(c.ultimaSalida)}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums text-foreground">{formatoDuracion(c.segundos)}</td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">{c.ingresos}</td>
                  </tr>
                ))}
              </Tabla>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold tracking-tight text-foreground">
              <Users2 className="h-4 w-4 text-primary" aria-hidden="true" />
              Asistencia registrada en la jornada
            </h2>
            {asistenciaVentana.length === 0 ? (
              <p className="surface p-4 text-sm text-muted-foreground">
                Sin asistencias en firme en la franja de esta jornada todavía.
              </p>
            ) : (
              <Tabla columnas={["#", "Nombre", "Documento", "Hora de registro", "Origen"]}>
                {asistenciaVentana.map((a, i) => (
                  <tr key={i} className="transition-colors hover:bg-primary/[0.04]">
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-3 font-semibold text-foreground">{a.user.fullName}</td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">{a.user.documentNumber}</td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums">{etiquetaHora(a.registeredAt)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "rounded-md px-2 py-0.5 text-[11px] font-bold",
                          a.source === "AUTOMATIC" ? "bg-success/15 text-success" : "bg-primary/12 text-primary"
                        )}
                      >
                        {a.source === "AUTOMATIC" ? "Automática (sala)" : "Manual"}
                      </span>
                    </td>
                  </tr>
                ))}
              </Tabla>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold tracking-tight text-foreground">
              <ClipboardList className="h-4 w-4 text-primary" aria-hidden="true" />
              Encuestas de la capacitación
            </h2>
            {encuestas.length === 0 ? (
              <p className="surface p-4 text-sm text-muted-foreground">
                Esta capacitación no tiene encuestas todavía. Se crean desde la página de la capacitación.
              </p>
            ) : (
              <Tabla columnas={["Encuesta", "Estado", "Respuestas", ""]}>
                {encuestas.map((e) => {
                  const estado = ESTADO_ENCUESTA[e.status] ?? { etiqueta: e.status, clase: "bg-muted text-muted-foreground" };
                  return (
                    <tr key={e.id} className="transition-colors hover:bg-primary/[0.04]">
                      <td className="px-4 py-3 font-semibold text-foreground">{e.title}</td>
                      <td className="px-4 py-3">
                        <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-bold", estado.clase)}>{estado.etiqueta}</span>
                      </td>
                      <td className="px-4 py-3 font-semibold tabular-nums">{e._count.responses}</td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/encuestas/${e.id}/resultados`}
                          className="inline-flex items-center gap-1 text-[12px] font-bold text-primary hover:underline"
                        >
                          Ver resultados <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </Tabla>
            )}
          </section>

          <div className="surface flex flex-wrap items-center justify-between gap-3 p-5">
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-foreground">
                <FileText className="h-4 w-4 text-primary" aria-hidden="true" />
                Informe de la capacitación
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                El PDF consolida todas las jornadas de la capacitación; se descarga desde la página de la capacitación
                cuando esta se cierra.
              </p>
            </div>
            <Link
              href={`${basePath}/${planId}/actividades/${activityId}`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary/10 px-3.5 py-2 text-[12.5px] font-bold text-primary transition-colors hover:bg-primary/15"
            >
              Ir a la capacitación <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </>
      ) : (
        <>
          <div className="flex justify-end">
            <a
              href={`/api/planes-capacitacion/sesiones/${sesion.id}/csv`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-card/70 px-3.5 py-2 text-[12.5px] font-bold text-foreground transition-colors hover:border-primary/40"
            >
              Exportar corte de la sesión (CSV)
            </a>
          </div>

          <PanelSesionVivo
            sesionId={sesion.id}
            faseInicial={sesion.fase}
            fichaUrl={`${basePath}/${planId}/actividades/${activityId}/sesion/${sesion.id}/ficha`}
            asistentesIniciales={asistentes.map((a) => ({
              nombre: a.user.fullName,
              documento: a.user.documentNumber,
              hora: FORMATO_HORA_SEG.format(a.registradaEn),
              medio: a.medio,
            }))}
          />
        </>
      )}
    </div>
  );
}
