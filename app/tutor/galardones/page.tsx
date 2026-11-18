import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth-helpers";
import { veComoAdmin } from "@/lib/roles";
import { gestionaGalardones } from "@/lib/galardones/acceso";
import { GestionGalardones } from "@/components/galardones/admin/gestion-galardones";

/**
 * Gestión de Galardones para una cuenta que no es administradora pero tiene
 * el permiso propio del módulo (canManageGalardones). Misma pantalla y mismas
 * acciones que /admin/galardones.
 */
export default async function GalardonesTutorPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sesion = await requireSession("/tutor/galardones");
  if (veComoAdmin(sesion.user.role)) redirect("/admin/galardones");
  if (!(await gestionaGalardones(sesion.user))) redirect("/no-autorizado");
  return <GestionGalardones sp={await searchParams} base="/tutor/galardones" soloLectura={false} />;
}
