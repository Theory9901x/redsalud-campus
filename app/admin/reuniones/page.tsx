import { Presentation } from "lucide-react";
import { requireTutorOrAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { listarReuniones } from "@/lib/reuniones";
import { crearReunionAction } from "@/app/admin/reuniones/actions";
import { PestanasModulo } from "@/components/comites/pestanas-modulo";
import { ModuloHero } from "@/components/training-plans/modulo-hero";
import { PanelDeslizable } from "@/components/training-plans/panel-deslizable";
import { TablaReuniones } from "@/components/reuniones/tabla-reuniones";
import { accesoReuniones } from "@/lib/reuniones-access";
import { FormularioReunion } from "@/components/reuniones/formularios";
import { EmptyState } from "@/components/brand/empty-state";

const FECHA = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Bogota" });

/**
 * REUNIONES ABIERTAS: fuera del PIC y de los comités. Cada reunión tiene una
 * o varias sesiones; cada sesión, su enlace de registro abierto (nombre y
 * cargo), su QR, su sala, su asistencia con permanencia real y su acta.
 */
export default async function ReunionesPage() {
  const session = await requireTutorOrAdmin();
  const { user } = await accesoReuniones();
  const basePath = session.user.role === "TUTOR" ? "/tutor/reuniones" : "/admin/reuniones";
  const [reuniones, anfitriones] = await Promise.all([
    listarReuniones(),
    prisma.trainingArea.findMany({
      where: {
        isActive: true,
        tutor: { status: "ACTIVE", role: { in: ["ADMIN", "TUTOR"] } },
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const totales = reuniones.reduce(
    (t, r) => ({ sesiones: t.sesiones + r.sesiones, abiertas: t.abiertas + r.abiertas, registrados: t.registrados + r.registrados, actas: t.actas + r.actas }),
    { sesiones: 0, abiertas: 0, registrados: 0, actas: 0 }
  );

  return (
    <div className="space-y-6">
      {session.user.role !== "TUTOR" && <PestanasModulo activa="reuniones" />}
      <ModuloHero
        eyebrow="Reuniones abiertas"
        Icono={Presentation}
        titulo="Reuniones"
        acento="y actas"
        descripcion={user.role === "SEGUIMIENTO" ? "Consulta las reuniones de todas las áreas." : user.canManageAllMeetings ? "Consulta y administra las reuniones de todas las áreas." : "Consulta y administra únicamente las reuniones que has creado."}
        cifras={[
          { valor: reuniones.length, etiqueta: "Reuniones" },
          { valor: totales.sesiones, etiqueta: "Sesiones", detalle: `${totales.abiertas} abiertas` },
          { valor: totales.registrados, etiqueta: "Asistentes registrados" },
          { valor: totales.actas, etiqueta: "Actas firmadas", detalle: `de ${totales.sesiones} sesiones` },
        ]}
        acciones={
          user.role !== "SEGUIMIENTO" ? <PanelDeslizable centrado
            etiqueta="Nueva reunión"
            titulo="Nueva reunión abierta"
            descripcion="Define la reunión y sus sesiones. Cada sesión queda con su enlace de registro, su QR y su sala virtual."
          >
            <FormularioReunion action={crearReunionAction} anfitriones={anfitriones.map((a) => ({ id: a.id, nombre: a.name }))} />
          </PanelDeslizable> : undefined
        }
      />

      {reuniones.length === 0 ? (
        <EmptyState icon={Presentation} title="Todavía no hay reuniones abiertas" description="Crea la primera con el botón «Nueva reunión»." className="py-16" />
      ) : (
        <TablaReuniones basePath={basePath} reuniones={reuniones.map((r) => ({
          ...r,
          fecha: r.primeraFecha ? FECHA.format(r.primeraFecha) : "Sin fecha",
          fechaOrden: r.primeraFecha?.toISOString() ?? "",
        }))} />
      )}
    </div>
  );
}
