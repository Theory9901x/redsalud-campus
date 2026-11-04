import { redirect } from "next/navigation";

/** Los resultados y la gestión viven ahora en el panel admin (/admin/galardones). */
export default function ResultadosGalardonesPage() {
  redirect("/admin/galardones");
}
