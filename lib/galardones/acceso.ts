import type { AdminSection, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { veComoAdmin } from "@/lib/roles";

type Usuario = { id: string; role: Role; restrictedAdminSections?: AdminSection[] | null };

/**
 * Quién ve, gestiona y administra Galardones (resultados, postulaciones,
 * ganadores, convocatoria, ceremonia y Excel): la administración con la
 * sección Usuarios, o una cuenta con el permiso propio `canManageGalardones`
 * (p. ej. el área de Sistemas, que es TUTOR). Se lee de la base en cada
 * petición: quitar el permiso surte efecto sin esperar a que caduque la sesión.
 */
export async function gestionaGalardones(u: Usuario | null | undefined): Promise<boolean> {
  if (!u) return false;
  if (veComoAdmin(u.role)) return !(u.restrictedAdminSections ?? []).includes("USUARIOS");
  const fila = await prisma.user.findUnique({ where: { id: u.id }, select: { canManageGalardones: true, status: true } });
  return !!fila?.canManageGalardones && fila.status === "ACTIVE";
}

/** Dónde vive la gestión para cada perfil: el panel admin, o el espacio de tutor. */
export function rutaGestionGalardones(role: Role | null | undefined): string {
  return veComoAdmin(role) ? "/admin/galardones" : "/tutor/galardones";
}
