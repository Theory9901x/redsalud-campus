import { PaginaSesionVivo } from "@/components/sesiones/pagina-sesion-vivo";

export default async function SesionVivoTutorPage({
  params,
}: {
  params: Promise<{ id: string; activityId: string; sesionId: string }>;
}) {
  const { id, activityId, sesionId } = await params;
  return (
    <PaginaSesionVivo sesionId={sesionId} basePath="/tutor/planes-capacitacion" planId={id} activityId={activityId} />
  );
}
