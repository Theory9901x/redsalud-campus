import { PaginaActividad } from "@/components/training-plans/pagina-actividad";

/**
 * Una capacitación del plan. La página es la misma para administración y
 * tutor (components/training-plans/pagina-actividad.tsx); aquí solo cambia
 * la ruta base.
 */
export default async function AdminActividadDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; activityId: string }>;
  searchParams: Promise<{ asistencia?: string; pagina?: string; t?: string }>;
}) {
  const { id, activityId } = await params;
  const { asistencia = "", pagina, t } = await searchParams;
  return (
    <PaginaActividad
      basePath="/admin/planes-capacitacion"
      planId={id}
      activityId={activityId}
      buscarAsistencia={asistencia}
      paginaParam={pagina}
      trimestreParam={t}
    />
  );
}
