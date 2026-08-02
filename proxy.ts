import { NextResponse } from "next/server";
import { auth } from "@/auth";
import type { AdminSection, Role } from "@prisma/client";

const ADMIN_PREFIX = "/admin";
const TUTOR_PREFIX = "/tutor";
const CAMBIO_CLAVE = "/cambiar-contrasena";

// Prefijos de sección del panel admin que un ADMIN puntual puede tener
// restringidos (niveles de administrador). El primer prefijo que matchea
// gana, así que van del más específico al más genérico donde aplica.
const ADMIN_SECTION_PREFIXES: [string, AdminSection][] = [
  ["/admin/usuarios", "USUARIOS"],
  ["/admin/cursos", "CURSOS"],
  ["/admin/planes-capacitacion", "PLANES_CAPACITACION"],
  ["/admin/inscripciones", "INSCRIPCIONES"],
  ["/admin/certificados", "CERTIFICADOS"],
  ["/admin/notificaciones", "NOTIFICACIONES"],
  ["/admin/reportes", "REPORTES"],
  ["/admin/configuracion", "CONFIGURACION"],
];

function roleHome(role: Role) {
  if (role === "ADMIN") return "/admin";
  if (role === "TUTOR") return "/tutor";
  return "/inicio";
}

// Nota: Next.js 16 renombró "middleware.ts" a "proxy.ts" (misma función, nuevo nombre).
export default auth((request) => {
  const { pathname } = request.nextUrl;
  const session = request.auth;

  if (pathname === "/login" || pathname === "/registro") {
    if (session?.user) {
      return NextResponse.redirect(new URL(roleHome(session.user.role), request.url));
    }
    return NextResponse.next();
  }

  if (!session?.user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const { role } = session.user;

  /*
   * Contraseña temporal: nada más hasta que la cambie.
   *
   * Provisionar una cuenta con una clave que se entrega por fuera -en un
   * correo, en un papel, en un chat- solo es aceptable si esa clave deja de
   * servir en cuanto la persona entra. La marca mustChangePassword existía
   * desde el principio y nadie la miraba, así que las contraseñas temporales
   * seguían siendo válidas indefinidamente.
   *
   * Se comprueba después de la sesión y antes que los permisos de rol: el
   * cambio va primero que cualquier destino.
   */
  if (session.user.mustChangePassword && pathname !== CAMBIO_CLAVE) {
    return NextResponse.redirect(new URL(CAMBIO_CLAVE, request.url));
  }

  if (pathname.startsWith(ADMIN_PREFIX)) {
    if (role !== "ADMIN") {
      return NextResponse.redirect(new URL("/no-autorizado", request.url));
    }

    const restricted = session.user.restrictedAdminSections ?? [];
    const matchedSection = ADMIN_SECTION_PREFIXES.find(([prefix]) => pathname.startsWith(prefix))?.[1];
    if (matchedSection && restricted.includes(matchedSection)) {
      return NextResponse.redirect(new URL("/no-autorizado", request.url));
    }
  }

  if (pathname.startsWith(TUTOR_PREFIX) && role !== "ADMIN" && role !== "TUTOR") {
    return NextResponse.redirect(new URL("/no-autorizado", request.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/admin/:path*",
    "/tutor/:path*",
    "/inicio/:path*",
    "/perfil/:path*",
    "/mi-aula/:path*",
    "/aula/:path*",
    "/mis-capacitaciones/:path*",
    "/mis-certificados/:path*",
    "/mis-encuestas/:path*",
    "/cambiar-contrasena",
    "/login",
    "/registro",
  ],
};
