import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireSession } from "@/lib/auth-helpers";
import { esIntegranteDe } from "@/lib/comites";
import { getReunionComite } from "@/lib/comites-reunion";
import { FichaReunion } from "@/components/comites/ficha-reunion";

/** Registro de una sesión del comité, para sus integrantes (solo lectura). */
export default async function MiReunionComitePage({ params }: { params: Promise<{ id: string; activityId: string }> }) {
  const { id, activityId } = await params;
  const session = await requireSession(`/mis-comites/${id}/reuniones/${activityId}`);
  const esGestor = session.user.role === "ADMIN" || session.user.role === "TUTOR";
  if (!esGestor && !(await esIntegranteDe(session.user.id, id))) notFound();
  const reunion = await getReunionComite(id, activityId);
  if (!reunion) notFound();

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <Link href={`/mis-comites/${id}`} className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        {reunion.actividad.plan.title}
      </Link>
      <FichaReunion reunion={reunion} />
    </div>
  );
}
