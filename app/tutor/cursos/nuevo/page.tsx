import { redirect } from "next/navigation";

/**
 * Crear cursos es del administrador. Esta ruta existió cuando los tutores
 * podían crear los suyos; se conserva solo para que un enlace viejo no
 * termine en 404, y manda de vuelta a la lista.
 */
export default function NuevoCursoTutorPage() {
  redirect("/tutor/cursos");
}
