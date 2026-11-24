import { redirect } from "next/navigation";

/**
 * Las capacitaciones independientes ya no tienen pantalla propia: salen en la
 * agenda de «Mis capacitaciones», mezcladas por fecha con las del plan y
 * marcadas como «Independiente». La ruta queda por los enlaces ya compartidos.
 */
export default function IndependientesRedirect() {
  redirect("/mis-capacitaciones");
}
