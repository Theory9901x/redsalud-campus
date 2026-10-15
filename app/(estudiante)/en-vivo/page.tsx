import { redirect } from "next/navigation";

/** «En vivo» vive dentro de Mis capacitaciones; esta ruta queda por los enlaces ya compartidos. */
export default function EnVivoRedirect() {
  redirect("/mis-capacitaciones/en-vivo");
}
