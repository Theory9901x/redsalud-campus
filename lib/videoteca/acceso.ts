import { cache } from "react";
import type { AdminSection, Role } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { esSoloLectura, veComoAdmin } from "@/lib/roles";
import { esAreaSiau } from "@/lib/encuestas/acceso-siau";

/**
 * Quién gestiona la Videoteca (subir, editar, publicar, borrar): un
 * administrador con escritura y la sección CURSOS habilitada.
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

/**
 * ¿La cuenta es del personal SIAU? Área, cargo o dependencia que diga SIAU o
 * «Atención al Usuario», o el tutor que responde por esa área. Memoizada por
 * petición: el layout (menú) y la página la piden a la vez.
 */
const esPersonalSiau = cache(async (userId: string) => {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      status: true,
      department: true,
      position: true,
      cargo: { select: { nombre: true } },
      // Áreas del plan de capacitación de las que es tutor.
      trainingAreasLed: { select: { name: true } },
    },
  });
  if (!u || u.status !== "ACTIVE") return false;
  return [u.department, u.position, u.cargo?.nombre, ...u.trainingAreasLed.map((a) => a.name)].some((t) => !!t && esAreaSiau(t));
});

type UsuarioSesion = { id: string; role: Role; restrictedAdminSections?: AdminSection[] | null };

/**
 * QUIÉN VE LOS VIDEOS DE SIAU (los marcados `soloSiau`): SOLO el personal
 * SIAU y quien gestiona la videoteca desde el panel (/admin/videos). Esos
 * videos traen credenciales de la cuenta de consulta SIAU en la descripción
 * (así lo pidió Talento Humano el 12-nov-2026). Una sola regla para las
 * páginas, la portada y el archivo del video.
 */
export async function veVideosSiau(usuario: UsuarioSesion | null | undefined): Promise<boolean> {
  if (!usuario) return false;
  if (veComoAdmin(usuario.role) && !(usuario.restrictedAdminSections ?? []).includes("CURSOS")) return true;
  return esPersonalSiau(usuario.id);
}

/**
 * QUIÉN ENTRA A LA VIDEOTECA (/videos) y la tiene en el menú: cualquier
 * persona con sesión -estudiantes, docentes y administradores- (24-nov-2026).
 * Qué videos ve cada quien lo decide `veVideosSiau`.
 */
export function puedeVerVideoteca(usuario: { id: string } | null | undefined): boolean {
  return !!usuario;
}

/** ¿Un video queda restringido a SIAU? Lo marcado, y siempre lo del área SIAU. */
export function restringidoASiau(soloSiau: boolean, categoria: string | null) {
  return soloSiau || (!!categoria && esAreaSiau(categoria));
}
