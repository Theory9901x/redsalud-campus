import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, CalendarClock, FileText, Lock } from "lucide-react";
import { requireTutorOrAdmin } from "@/lib/auth-helpers";
import { getReunionComite } from "@/lib/comites-reunion";
import { cerrarReunionAction, reabrirReunionAction, fijarJornadaReunionAction, subirActaAction } from "@/app/admin/comites/actions";
import { FichaReunion } from "@/components/comites/ficha-reunion";
import { BotonAccionReunion, FormularioJornadaReunion, FormularioDocumentoComite } from "@/components/comites/formularios";

/**
 * GESTIÓN DE UNA SESIÓN del comité (administrador): la ficha de la reunión
 * con sus acciones -cerrar para congelar cifras y habilitar el informe
 * PDF, reabrir, ir a la gestión completa-.
 */
export default async function ReunionComiteAdminPage({ params }: { params: Promise<{ id: string; activityId: string }> }) {
  const { id, activityId } = await params;
  const sesion = await requireTutorOrAdmin();
  const reunion = await getReunionComite(id, activityId);
  if (!reunion) notFound();
  const cerrada = reunion.actividad.status === "CLOSED";

  const acciones = (
    <>
    {!reunion.sesion && !cerrada && (
      <div className="comite-tarjeta border-warning/40 p-5">
        <h2 className="flex items-center gap-2 font-display text-[14px] font-bold uppercase tracking-wide text-foreground">
          <CalendarClock className="h-4 w-4 text-warning-foreground" aria-hidden="true" />
          Esta reunión no tiene fecha ni hora
        </h2>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          La sala, el enlace y el QR ya existen, pero sin fecha los integrantes no la ven como próxima reunión en su panel. Fíjala aquí.
        </p>
        <div className="mt-4">
          <FormularioJornadaReunion action={fijarJornadaReunionAction.bind(null, id, activityId)} />
        </div>
      </div>
    )}
    <div className="comite-tarjeta flex flex-wrap items-center justify-between gap-3 p-5">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 font-display text-[14px] font-bold uppercase tracking-wide text-foreground">
          <FileText className="h-4 w-4 text-primary" aria-hidden="true" />
          Informe de la sesión
        </h2>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          {cerrada
            ? "Sesión cerrada: las cifras quedaron congeladas y el informe PDF está disponible."
            : "Cierra la sesión al terminar para congelar la asistencia y generar el informe PDF completo (asistencia, conexiones, grabaciones)."}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {cerrada ? (
          <>
            <a href={`/api/planes-capacitacion/actividades/${activityId}/informe`} className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-primary to-teal-400 px-4 py-2.5 text-[13px] font-bold text-white shadow-md shadow-primary/25">
              <FileText className="h-4 w-4" aria-hidden="true" />
              Descargar informe PDF
            </a>
            {sesion.user.role === "ADMIN" && (
              <BotonAccionReunion accion={reabrirReunionAction.bind(null, id, activityId)} etiqueta="Reabrir sesión" variante="secundaria" />
            )}
          </>
        ) : (
          <>
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-muted px-3 py-2 text-[12px] font-semibold text-muted-foreground">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              PDF al cerrar
            </span>
            <BotonAccionReunion accion={cerrarReunionAction.bind(null, id, activityId)} etiqueta="Cerrar sesión" confirmar="¿Cerrar esta sesión? Se congelan la asistencia y las conexiones y se habilita el informe." />
          </>
        )}
        <Link href={`/admin/planes-capacitacion/${id}/actividades/${activityId}`} className="inline-flex items-center gap-1 rounded-xl border border-border/60 bg-card/70 px-3 py-2 text-[12.5px] font-bold text-foreground transition-colors hover:border-primary/40">
          Vista técnica (capacitación) <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </div>
    </>
  );

  return (
    <div className="space-y-6">
      <Link href={`/admin/comites/${id}`} className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        {reunion.actividad.plan.title}
      </Link>
      <FichaReunion reunion={reunion} acciones={acciones} formularioActa={<FormularioDocumentoComite action={subirActaAction.bind(null, id, activityId)} />} />
    </div>
  );
}
