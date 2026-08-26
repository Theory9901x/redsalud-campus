import { PaginaSesionVivo } from "@/components/sesiones/pagina-sesion-vivo";

export default async function SesionVivoAdminPage({
  params,
}: {
  params: Promise<{ id: string; activityId: string; sesionId: string }>;
}) {
  const { id, activityId, sesionId } = await params;
  return (
    <PaginaSesionVivo sesionId={sesionId} basePath="/admin/planes-capacitacion" planId={id} activityId={activityId} />
  );
}
