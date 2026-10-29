import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { ArrowLeft, CalendarClock, FileDown, FileText, MapPin, Pencil, QrCode, UserRound, Users2, Video } from "lucide-react";
import { requireTutorOrAdmin } from "@/lib/auth-helpers";
import { getSesionReunion } from "@/lib/reuniones";
import { getAreasAnfitrionas, getGestionReunion } from "@/lib/reuniones-gestion";
import { GestionReunionEnVivo } from "@/components/reuniones/gestion-en-vivo";
import { eliminarReunionAction, reprogramarSesionAction, subirActaFirmadaAction } from "@/app/admin/reuniones/actions";
import { EliminarReunion, ReprogramarSesion, SubirActaFirmada } from "@/components/reuniones/formularios";
import { prisma } from "@/lib/prisma";
import { VistaActividad, SeccionActividad, type PestanaActividad } from "@/components/training-plans/vista-actividad";
import { ActivityQrPanel } from "@/components/training-plans/activity-qr-panel";
import { RegistroDocumentos } from "@/components/documentos/registro-documentos";
import { etiquetaJornada } from "@/components/training-plans/labels";
import { accesosDeJornada } from "@/lib/jornadas";
import { EmptyState } from "@/components/brand/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const HORA = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" });

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return <section className="space-y-1.5"><h3 className="mono-label">{titulo}</h3>{children}</section>;
}
const texto = (v: string | null | undefined, vacio: string) => v?.trim()
  ? <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-foreground">{v}</p>
  : <p className="text-[14px] italic text-muted-foreground">{vacio}</p>;

/**
 * Sesión de una reunión. Por defecto es el MÓDULO de consulta (asistencia,
 * acta y accesos, sin formularios). El panel de edición solo aparece con
 * «Editar» (?editar=1) y se sale de él volviendo a este módulo.
 */
export default async function SesionReunionPage({ params, searchParams }: { params: Promise<{ id: string; activityId: string }>; searchParams: Promise<{ editar?: string }> }) {
  const session = await requireTutorOrAdmin();
  const { id, activityId } = await params;
  const { editar } = await searchParams;
  const [d, gestion, areas, totalSesiones] = await Promise.all([getSesionReunion(id, activityId), getGestionReunion(id, activityId), getAreasAnfitrionas(), prisma.trainingActivity.count({ where: { planId: id } })]);
  if (!d || !gestion) notFound();
  const base = session.user.role === "TUTOR" ? "/tutor/reuniones" : "/admin/reuniones";
  const aqui = `${base}/${id}/sesiones/${activityId}`;
  const volver = totalSesiones > 1 ? { href: `${base}/${id}`, etiqueta: d.reunion.titulo } : { href: base, etiqueta: "Reuniones" };
  const acta = `/api/reuniones/${id}/sesiones/${activityId}/acta`;
  const enlaces = d.jornada ? await Promise.all(accesosDeJornada(APP_URL, activityId, d.jornada.tokenPublico, { conEvaluacion: false, modalidad: d.jornada.modality, audience: d.jornada.audience }).filter(a => a.clave === "sala" || a.clave === "invitados").map(async a => ({ ...a, qrDataUrl: await QRCode.toDataURL(a.url, { width: 320, margin: 1 }) }))) : [];
  const puedeEliminar = session.user.role === "ADMIN" || d.puedeEditarReunion || d.anfitrionId === session.user.id;

  if (editar === "1" && d.puedeGestionar) return <div className="space-y-6">
    <Link href={aqui} className="inline-flex items-center gap-2 text-base font-semibold text-muted-foreground"><ArrowLeft className="h-4 w-4" />Volver al módulo de la reunión</Link>
    <header className="space-y-2 rounded-2xl border bg-card p-6">
      <p className="text-base font-semibold text-primary">Editando reunión</p>
      <h1 className="text-3xl font-semibold">{d.titulo}</h1>
      {d.jornada && <p className="flex items-center gap-2 text-base text-muted-foreground"><CalendarClock className="h-5 w-5" />{etiquetaJornada(d.jornada)}</p>}
    </header>
    <GestionReunionEnVivo inicial={gestion} areas={areas} editarInicial salirHref={aqui} formularioActaFirmada={<SubirActaFirmada action={subirActaFirmadaAction.bind(null, id, activityId)} />} />
  </div>;

  const conActa = d.documentos.filter((doc) => doc.kind === "ACTA" || doc.fileName.toUpperCase().includes("ACTA"));

  const pestanas: PestanaActividad[] = [
    {
      valor: "asistencia",
      etiqueta: "Asistencia",
      Icono: Users2,
      conteo: d.asistentes.length,
      contenido: (
        <SeccionActividad
          titulo="Lista de asistencia"
          bajada="Registro por el enlace (nombre y cargo) y permanencia real en la sala. Es la misma lista que sale en el acta."
          accion={
            <div className="flex flex-wrap gap-2">
              <a href={`/api/reuniones/${id}/sesiones/${activityId}/asistencia/excel`} className={cn(buttonVariants({ size: "sm", variant: "outline" }), "gap-1.5")}>Asistencia Excel</a>
              <a href={`/api/reuniones/${id}/sesiones/${activityId}/asistencia/pdf`} className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}><FileDown className="h-3.5 w-3.5" aria-hidden="true" /> Asistencia PDF</a>
            </div>
          }
        >
          {d.asistentes.length === 0 ? (
            <EmptyState icon={Users2} title="Nadie se ha registrado todavía" description="Comparte el enlace o el QR de la pestaña «Accesos»." className="py-12" />
          ) : (
            <div className="tabla-modulo">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Registro</TableHead>
                    <TableHead className="text-right">Permanencia</TableHead>
                    <TableHead className="text-right">Conexiones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.asistentes.map((a, i) => (
                    <TableRow key={a.clave}>
                      <TableCell className="font-mono text-[11.5px] text-muted-foreground">{String(i + 1).padStart(2, "0")}</TableCell>
                      <TableCell className="font-semibold text-foreground">
                        {a.nombre}
                        {a.tipo === "cuenta" && <span className="ml-2 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">Con cuenta</span>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{a.cargo}</TableCell>
                      <TableCell className="font-mono text-[12px] text-muted-foreground">{a.registradoEl ? HORA.format(a.registradoEl) : "—"}</TableCell>
                      <TableCell className="text-right font-mono text-[12px]">{a.minutos > 0 ? `${a.minutos} min` : <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-right font-mono text-[12px] text-muted-foreground">{a.conexiones || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </SeccionActividad>
      ),
    },
    {
      valor: "acta",
      etiqueta: "Acta",
      Icono: FileText,
      conteo: d.compromisos.length,
      contenido: (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <SeccionActividad
            titulo="Contenido del acta"
            bajada={d.puedeGestionar ? "Para cambiar el contenido, pulsa «Editar»." : "Contenido registrado para esta sesión."}
            accion={
              <a href={acta} className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}>
                <FileDown className="h-3.5 w-3.5" aria-hidden="true" /> Descargar acta PDF
              </a>
            }
          >
            <div className="barra-modulo space-y-5 p-5">
              <Bloque titulo="Objetivo">{texto(d.objetivo, "Sin objetivo registrado.")}</Bloque>
              <Bloque titulo="Orden del día">
                {d.reunion.ordenDelDia.length ? (
                  <ol className="space-y-1.5">
                    {d.reunion.ordenDelDia.map((p, i) => (
                      <li key={i} className="flex gap-2.5 text-[14px] text-foreground"><span className="font-mono text-[12px] font-semibold text-primary">{String(i + 1).padStart(2, "0")}</span>{p.replace(/^\d+[.)]\s*/, "")}</li>
                    ))}
                  </ol>
                ) : texto(null, "Sin orden del día.")}
              </Bloque>
              <Bloque titulo="Desarrollo">{texto(d.desarrollo, "Sin desarrollo registrado.")}</Bloque>
              <Bloque titulo={`Compromisos y acuerdos (${d.compromisos.length})`}>
                {d.compromisos.length ? (
                  <ol className="space-y-2">
                    {d.compromisos.map((c, i) => (
                      <li key={i} className="flex gap-3 rounded-lg border border-border/60 bg-background/60 p-3 text-[14px] leading-relaxed text-foreground">
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-[12px] font-bold text-primary">{i + 1}</span>
                        <span className="min-w-0 whitespace-pre-wrap break-words">{c}</span>
                      </li>
                    ))}
                  </ol>
                ) : texto(null, "Todavía no hay compromisos.")}
              </Bloque>
            </div>
          </SeccionActividad>
          <div className="space-y-5">
            <SeccionActividad titulo="Acta firmada" bajada={conActa.length ? "Archivada como evidencia." : "Todavía no se ha subido el acta firmada."}>
              {conActa.length > 0 && <RegistroDocumentos documentos={conActa} contexto="reunion" compacto />}
            </SeccionActividad>
            <SeccionActividad titulo="Documentos de la sesión">
              <RegistroDocumentos documentos={d.documentos.filter((doc) => !conActa.includes(doc))} contexto="reunion" vacio="Sin documentos todavía." />
            </SeccionActividad>
          </div>
        </div>
      ),
    },
    {
      valor: "accesos",
      etiqueta: "Accesos",
      Icono: QrCode,
      contenido: (
        <div className="max-w-2xl">
          <ActivityQrPanel enlaces={enlaces} />
        </div>
      ),
    },
  ];

  return (
    <VistaActividad
      volver={volver}
      eyebrow="Sesión de reunión abierta"
      titulo={d.titulo}
      chips={[
        ...(d.jornada ? [{ Icono: CalendarClock, contenido: etiquetaJornada(d.jornada) }] : []),
        ...(d.dirigidoA ? [{ Icono: MapPin, contenido: d.dirigidoA }] : []),
        ...(d.responsable ? [{ Icono: UserRound, contenido: `Responsable: ${d.responsable}` }] : []),
      ]}
      estado={d.estado}
      acciones={
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/sala/${activityId}${d.jornada ? `?s=${d.jornada.tokenPublico}` : ""}`} target="_blank" className={cn(buttonVariants({ size: "sm", variant: "outline" }), "gap-1.5")}>
            <Video className="h-3.5 w-3.5" aria-hidden="true" /> Sala
          </Link>
          {d.puedeGestionar && <>
            <Link href={`${aqui}?editar=1`} className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}><Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Editar</Link>
            <ReprogramarSesion action={reprogramarSesionAction.bind(null, id, activityId)} fecha={gestion.fecha} inicio={gestion.inicio} fin={gestion.fin} />
          </>}
          {puedeEliminar && <EliminarReunion action={eliminarReunionAction.bind(null, id)} titulo={d.reunion.titulo} volverA={base} className="min-h-9" />}
        </div>
      }
      kpis={[
        { valor: d.resumen.registrados, etiqueta: "Asistentes", detalle: "registrados" },
        { valor: d.resumen.conectados, etiqueta: "En la sala", detalle: "con conexión real" },
        { valor: `${d.resumen.permanenciaPromedio}m`, etiqueta: "Permanencia", detalle: "promedio" },
        { valor: d.compromisos.length, etiqueta: "Compromisos" },
        { valor: d.reunion.ordenDelDia.length, etiqueta: "Puntos", detalle: "del orden del día" },
        { valor: conActa.length ? "Sí" : "No", etiqueta: "Acta firmada" },
      ]}
      pestanas={pestanas}
    />
  );
}
