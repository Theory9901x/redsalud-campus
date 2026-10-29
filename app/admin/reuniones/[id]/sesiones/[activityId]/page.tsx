import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { ArrowLeft, CalendarClock, FileDown, Video } from "lucide-react";
import { requireTutorOrAdmin } from "@/lib/auth-helpers";
import { getSesionReunion } from "@/lib/reuniones";
import { getAreasAnfitrionas, getGestionReunion } from "@/lib/reuniones-gestion";
import { GestionReunionEnVivo } from "@/components/reuniones/gestion-en-vivo";
import { reprogramarSesionAction, subirActaFirmadaAction } from "@/app/admin/reuniones/actions";
import { ReprogramarSesion, SubirActaFirmada } from "@/components/reuniones/formularios";
import { ActivityQrPanel } from "@/components/training-plans/activity-qr-panel";
import { etiquetaJornada } from "@/components/training-plans/labels";
import { accesosDeJornada } from "@/lib/jornadas";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export default async function SesionReunionPage({ params, searchParams }: { params: Promise<{ id: string; activityId: string }>; searchParams: Promise<{ editar?: string }> }) {
  const session = await requireTutorOrAdmin();
  const { id, activityId } = await params;
  const { editar } = await searchParams;
  const [d, gestion, areas] = await Promise.all([getSesionReunion(id, activityId), getGestionReunion(id, activityId), getAreasAnfitrionas()]);
  if (!d || !gestion) notFound();
  const base = session.user.role === "TUTOR" ? "/tutor/reuniones" : "/admin/reuniones";
  const enlaces = d.jornada ? await Promise.all(accesosDeJornada(APP_URL, activityId, d.jornada.tokenPublico, { conEvaluacion: false, modalidad: d.jornada.modality, audience: d.jornada.audience }).filter(a => a.clave === "sala" || a.clave === "invitados").map(async a => ({ ...a, qrDataUrl: await QRCode.toDataURL(a.url, { width: 320, margin: 1 }) }))) : [];
  return <div className="space-y-6">
    <Link href={`${base}/${id}`} className="inline-flex items-center gap-2 text-base font-semibold text-muted-foreground"><ArrowLeft className="h-4 w-4" />Volver a la reunión</Link>
    <header className="space-y-4 rounded-2xl border bg-card p-6">
      <p className="text-base font-semibold text-primary">Panel de la reunión</p>
      <p className="text-lg font-semibold">{d.reunion.titulo}</p>
      <div className="flex flex-wrap items-center justify-between gap-4"><h1 className="text-3xl font-semibold">{d.titulo}</h1><span className="rounded-full border px-4 py-2 text-base font-semibold">{d.estado === "CLOSED" ? "Cerrada" : "Abierta hasta cierre manual"}</span></div>
      {d.jornada && <p className="flex items-center gap-2 text-base text-muted-foreground"><CalendarClock className="h-5 w-5" />{etiquetaJornada(d.jornada)}</p>}
      <p className="text-base text-muted-foreground">Consulta los compromisos, documentos, asistencia y acta de esta reunión. Para modificar información, pulsa Editar.</p>
      <div className="flex flex-wrap gap-3"><Link href={`/sala/${activityId}${d.jornada ? `?s=${d.jornada.tokenPublico}` : ""}`} target="_blank" className={cn(buttonVariants(), "min-h-12 gap-2 text-base")}><Video className="h-5 w-5" />Abrir sala virtual</Link><a href={`/api/reuniones/${id}/sesiones/${activityId}/acta`} className={cn(buttonVariants({ variant: "outline" }), "min-h-12 gap-2 text-base")}><FileDown className="h-5 w-5" />Descargar acta PDF</a>{d.puedeGestionar && <ReprogramarSesion action={reprogramarSesionAction.bind(null, id, activityId)} fecha={gestion.fecha} inicio={gestion.inicio} fin={gestion.fin} className="min-h-12 px-4 text-base" />}</div>
    </header>
    <GestionReunionEnVivo inicial={gestion} areas={areas} editarInicial={editar === "1" && gestion.puedeGestionar && !gestion.cerrada} formularioActaFirmada={d.puedeGestionar ? <SubirActaFirmada action={subirActaFirmadaAction.bind(null, id, activityId)} /> : undefined} />
    <section id="accesos-reunion" className="space-y-4 rounded-2xl border bg-card p-6"><h2 className="text-2xl font-semibold">Enlaces y QR de la reunión</h2><p className="text-base text-muted-foreground">Accesos disponibles según el tipo de participantes definido para esta sesión.</p><ActivityQrPanel enlaces={enlaces} /></section>
  </div>;
}
