import { requireTutorOrAdmin } from "@/lib/auth-helpers";
import { getCapacitacionesEnVivo } from "@/lib/en-vivo";
import { VistaEnVivo } from "@/components/en-vivo/vista-en-vivo";
import { PestanasModulo } from "@/components/comites/pestanas-modulo";

export const dynamic = "force-dynamic";

/** Plan de capacitaciones · En vivo (administración): qué llamadas están abiertas ahora en toda la institución. */
export default async function AdminEnVivoPage() {
  await requireTutorOrAdmin();
  const fichas = await getCapacitacionesEnVivo({ verPruebas: true });
  return <VistaEnVivo fichas={fichas} pestanas={<PestanasModulo activa="en-vivo" />} />;
}
