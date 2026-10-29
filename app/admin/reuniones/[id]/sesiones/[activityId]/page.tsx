import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { CalendarClock, FileDown, FileText, MapPin, QrCode, UserRound, Users2 } from "lucide-react";
import { requireTutorOrAdmin } from "@/lib/auth-helpers";
import { getSesionReunion } from "@/lib/reuniones";
import { RefrescarAsistencia } from "@/components/reuniones/refrescar-asistencia";
import {
  cerrarSesionAction,
  eliminarSesionAction,
  guardarActaAction,
  reabrirSesionAction,
  subirActaFirmadaAction,
} from "@/app/admin/reuniones/actions";
import { VistaActividad, SeccionActividad, type PestanaActividad } from "@/components/training-plans/vista-actividad";
import { ActivityQrPanel, type EnlaceQr } from "@/components/training-plans/activity-qr-panel";
import { RegistroDocumentos } from "@/components/documentos/registro-documentos";
import { etiquetaJornada } from "@/components/training-plans/labels";
import { AccionesSesion, FormularioActa, SubirActaFirmada } from "@/components/reuniones/formularios";
import { EmptyState } from "@/components/brand/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const HORA = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" });

export default async function SesionReunionPage({ params }: { params: Promise<{ id: string; activityId: string }> }) {
  const sesion = await requireTutorOrAdmin();
  const basePath = sesion.user.role === "TUTOR" ? "/tutor/reuniones" : "/admin/reuniones";
  const { id, activityId } = await params;
  const d = await getSesionReunion(id, activityId);
  if (!d) notFound();

  const enlaces: EnlaceQr[] = await Promise.all(
    [
      { titulo: "Registro y sala", descripcion: "Para los asistentes: nombre completo y cargo, y entran a la sala.", url: `${APP_URL}/invitado/${activityId}` },
      { titulo: "Sala (anfitrión)", descripcion: "Para quien conduce la reunión con su cuenta de la plataforma.", url: `${APP_URL}/sala/${activityId}` },
    ].map(async (e) => ({ ...e, qrDataUrl: await QRCode.toDataURL(e.url, { width: 320, margin: 1 }) }))
  );
  const cerrada = d.estado === "CLOSED";
  const acta = `/api/reuniones/${id}/sesiones/${activityId}/acta`;
  const conActa = d.documentos.filter((doc) => doc.fileName.includes("ACTA"));

  const pestanas: PestanaActividad[] = [
    {
      valor: "asistencia",
      etiqueta: "Asistencia",
      Icono: Users2,
      conteo: d.asistentes.length,
      contenido: (
        <SeccionActividad
          titulo="Lista de asistencia"
          bajada="Asistencia automática de quienes ingresaron a la sala. Una fila por persona, con nombre, cargo y permanencia. Se actualiza cada 30 segundos mientras la reunión está abierta."
          accion={
            <div className="flex flex-wrap items-center gap-2"><RefrescarAsistencia abierta={!cerrada} /><a href={`/api/reuniones/${id}/sesiones/${activityId}/asistencia/excel`} className={cn(buttonVariants({ size: "sm", variant: "outline" }), "gap-1.5")}>Asistencia Excel</a><a href={`/api/reuniones/${id}/sesiones/${activityId}/asistencia/pdf`} className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}>Asistencia e informe PDF</a></div>
          }
        >
          {d.asistentes.length === 0 ? (
            <EmptyState icon={Users2} title="Nadie ha ingresado a la sala todavía" description="La asistencia aparece automáticamente cuando una persona entra a la reunión." className="py-12" />
          ) : (
            <div className="tabla-modulo">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Ingreso</TableHead>
                    <TableHead>Salida / estado</TableHead>
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
                      <TableCell className="text-sm text-muted-foreground">{a.salidaEl ? HORA.format(a.salidaEl) : a.estado}</TableCell>
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
      conteo: conActa.length,
      contenido: (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <SeccionActividad
            titulo="Contenido del acta"
            bajada={cerrada ? "La sesión está cerrada: el contenido queda congelado." : "Lo que escribas aquí sale en el acta en PDF junto con la lista de asistencia."}
            accion={
              <a href={acta} className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}>
                <FileDown className="h-3.5 w-3.5" aria-hidden="true" /> Descargar acta PDF
              </a>
            }
          >
            <div className="barra-modulo form-premium p-5">
              <FormularioActa
                action={guardarActaAction.bind(null, id, activityId)}
                bloqueado={cerrada}
                valores={{ objetivo: d.objetivo ?? "", desarrollo: d.desarrollo, compromisos: d.compromisos.join("\n"), ordenDelDia: d.reunion.ordenDelDia.join("\n") }}
              />
            </div>
          </SeccionActividad>
          <div className="space-y-5">
            <SeccionActividad titulo="Acta firmada" bajada="Descarga el PDF, fírmalo y súbelo escaneado: queda archivado como evidencia.">
              <div className="barra-modulo form-premium p-5">
                <SubirActaFirmada action={subirActaFirmadaAction.bind(null, id, activityId)} />
              </div>
            </SeccionActividad>
            <SeccionActividad titulo="Documentos de la sesión">
              <RegistroDocumentos
                documentos={d.documentos}
                contexto="reunion"
                vacio="Sin documentos todavía. Sube el primero con el formulario de abajo: indica qué documento es y una descripción corta."
              />
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
      volver={{ href: `${basePath}/${id}`, etiqueta: d.reunion.titulo }}
      eyebrow="Sesión de reunión abierta"
      titulo={d.titulo}
      chips={[
        ...(d.jornada ? [{ Icono: CalendarClock, contenido: etiquetaJornada(d.jornada) }] : []),
        ...(d.dirigidoA ? [{ Icono: MapPin, contenido: d.dirigidoA }] : []),
        ...(d.responsable ? [{ Icono: UserRound, contenido: `Responsable: ${d.responsable}` }] : []),
      ]}
      estado={d.estado}
      acciones={
        <AccionesSesion
          estado={d.estado}
          esAdmin={sesion.user.role === "ADMIN"}
          onCerrar={cerrarSesionAction.bind(null, id, activityId)}
          onReabrir={reabrirSesionAction.bind(null, id, activityId)}
          onEliminar={eliminarSesionAction.bind(null, id, activityId)}
        />
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
