import { auth } from "@/auth";
import { esSoloLectura, veComoAdmin } from "@/lib/roles";

/**
 * Quién gestiona la Videoteca (subir, editar, publicar, borrar): un
 * administrador con escritura y la sección CURSOS habilitada. Verla la ve
 * cualquier persona con cuenta activa.
 */
export async function gestorVideoteca() {
  const sesion = await auth();
  const u = sesion?.user;
  if (!u || !veComoAdmin(u.role) || esSoloLectura(u.role)) return null;
  if ((u.restrictedAdminSections ?? []).includes("CURSOS")) return null;
  return sesion;
}

export async function puedeVerResultadosVideoteca() {
  const sesion = await auth();
  const u = sesion?.user;
  if (!u || !veComoAdmin(u.role)) return null;
  if ((u.restrictedAdminSections ?? []).includes("CURSOS")) return null;
  return sesion;
}
