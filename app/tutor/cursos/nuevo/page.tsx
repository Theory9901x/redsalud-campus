import { redirect } from "next/navigation";

/**
 * Crear cursos es del administrador. Se conserva solo para que un enlace
 * viejo no termine en 404.
 */
export default function NuevoCursoTutorPage() {
  redirect("/tutor");
}
