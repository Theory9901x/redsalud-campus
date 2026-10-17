import { redirect } from "next/navigation";

/**
 * Las capacitaciones del Plan Institucional no generan constancias y las
 * áreas no revisan inducción ni reinducción: el tutor ya no tiene registro de
 * constancias. La ruta se conserva para que un enlace viejo no termine en 404.
 */
export default function TutorConstanciasPage() {
  redirect("/tutor");
}
