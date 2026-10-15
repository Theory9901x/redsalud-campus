import { requireTutorOrAdmin } from "@/lib/auth-helpers";
import { getCapacitacionesEnVivo } from "@/lib/en-vivo";
import { VistaEnVivo } from "@/components/en-vivo/vista-en-vivo";
import { PestanasPlanTutor } from "@/components/en-vivo/pestanas-plan-tutor";

export const dynamic = "force-dynamic";

/** Planes de capacitación · En vivo (tutor): las llamadas abiertas ahora, sin salir de su panel. */
export default async function TutorEnVivoPage() {
  await requireTutorOrAdmin();
  const fichas = await getCapacitacionesEnVivo({ verPruebas: true });
  return <VistaEnVivo fichas={fichas} pestanas={<PestanasPlanTutor activa="en-vivo" enVivo={fichas.filter((f) => f.estado === "EN_VIVO").length} />} />;
}
