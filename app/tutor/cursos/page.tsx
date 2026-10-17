import { redirect } from "next/navigation";

/**
 * El tutor es un área del Plan Institucional de Capacitaciones: su espacio
 * son las capacitaciones del plan, no un listado de cursos. La ruta se
 * conserva para que un enlace viejo no termine en 404 (los cursos y sus
 * datos siguen intactos; los gestiona el administrador).
 */
export default function TutorCursosPage() {
  redirect("/tutor");
}
