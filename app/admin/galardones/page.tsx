import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth-helpers";
import { esSoloLectura, veComoAdmin } from "@/lib/roles";
import { GestionGalardones } from "@/components/galardones/admin/gestion-galardones";

/** Gestión de Galardones en el panel admin. El contenido es compartido con /tutor/galardones. */
export default async function GalardonesAdminPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sesion = await requireSession("/admin/galardones");
  if (!veComoAdmin(sesion.user.role)) redirect("/no-autorizado");
  if ((sesion.user.restrictedAdminSections ?? []).includes("USUARIOS")) redirect("/no-autorizado");
  return <GestionGalardones sp={await searchParams} base="/admin/galardones" soloLectura={esSoloLectura(sesion.user.role)} />;
}
