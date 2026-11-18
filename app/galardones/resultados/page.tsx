import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth-helpers";
import { rutaGestionGalardones } from "@/lib/galardones/acceso";

/** Los resultados y la gestión viven en el panel de cada perfil. */
export default async function ResultadosGalardonesPage() {
  const sesion = await requireSession("/galardones/resultados");
  redirect(rutaGestionGalardones(sesion.user.role));
}
