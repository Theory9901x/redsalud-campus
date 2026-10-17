import { redirect } from "next/navigation";

/** El tutor gestiona capacitaciones de su área, no cursos: la evaluación se edita dentro de cada capacitación. */
export default function TutorCursoRedirect() {
  redirect("/tutor");
}
