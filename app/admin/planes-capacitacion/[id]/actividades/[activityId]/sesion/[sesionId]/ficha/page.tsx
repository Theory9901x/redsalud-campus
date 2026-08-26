import { FichaSesion } from "@/components/sesiones/ficha-sesion";

export default async function FichaSesionAdminPage({
  params,
}: {
  params: Promise<{ activityId: string; sesionId: string }>;
}) {
  const { activityId, sesionId } = await params;
  return <FichaSesion sesionId={sesionId} activityId={activityId} />;
}
