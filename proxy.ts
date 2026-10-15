import { NextResponse } from "next/server";
import { auth } from "@/auth";
import type { AdminSection, Role } from "@prisma/client";
import { soloEncuestas } from "@/lib/admin-sections";

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
  ["/admin/comites", "PLANES_CAPACITACION"],
  ["/admin/reuniones", "PLANES_CAPACITACION"],
  ["/admin/inscripciones", "INSCRIPCIONES"],
  ["/admin/certificados", "CERTIFICADOS"],
  ["/admin/notificaciones", "NOTIFICACIONES"],
  ["/admin/reportes", "REPORTES"],
  ["/admin/configuracion", "CONFIGURACION"],
];

// Rutas que exigen sesión y pasan por las reglas de rol de abajo. El proxy
// corre en TODAS las peticiones (para cortar las escrituras del rol de
// seguimiento en cualquier ruta), pero solo estas redirigen a login.
const RUTAS_PROTEGIDAS = [
  "/admin",
  "/tutor",
  "/inicio",
  "/perfil",
  "/mi-aula",
  "/aula",
  "/mis-capacitaciones",
  "/en-vivo",
  "/mis-certificados",
  "/evaluaciones",
  // El módulo de encuestas lo ven los tres roles, cada uno con su alcance.
  // El enlace público (/e/:slug) queda deliberadamente FUERA: se responde
  // sin cuenta.
  "/encuestas",
];
const RUTAS_DE_ACCESO = ["/cambiar-contrasena", "/login", "/registro"];

// Lo que el rol de seguimiento NO abre aunque esté dentro de /admin: son
// pantallas de solo escritura (formularios de alta, configuración).
const SOLO_ESCRITURA = [
  /^\/admin\/configuracion/,
  /^\/admin\/certificados\/plantilla/,
  /\/(nuevo|nueva|editar|constructor)(\/|$)/,
];

function roleHome(role: Role) {
  if (role === "ADMIN" || role === "SEGUIMIENTO") return "/admin";
  if (role === "TUTOR") return "/tutor";
  return "/inicio";
}

// Nota: Next.js 16 renombró "middleware.ts" a "proxy.ts" (misma función, nuevo nombre).
export default auth((request) => {
  const { pathname } = request.nextUrl;
  const session = request.auth;

  /*
   * SEGUIMIENTO (Control Interno) es de SOLO LECTURA, y eso se garantiza
   * aquí, en un solo punto: cualquier petición que no sea de lectura se
   * rechaza, venga de donde venga (acciones de servidor, APIs, formularios).
   * Solo puede cerrar sesión y cambiar su propia contraseña.
   */
  if (
    session?.user?.role === "SEGUIMIENTO" &&
    !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
    !pathname.startsWith("/api/auth") &&
    pathname !== CAMBIO_CLAVE
  ) {
    return NextResponse.json({ error: "Perfil de seguimiento: solo lectura. No se permiten cambios." }, { status: 403 });
  }

  const protegida = RUTAS_PROTEGIDAS.some((r) => pathname === r || pathname.startsWith(`${r}/`));
  if (!protegida && !RUTAS_DE_ACCESO.includes(pathname)) {
    return NextResponse.next();
  }

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

  if (role === "SEGUIMIENTO" && SOLO_ESCRITURA.some((r) => r.test(pathname))) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  if (pathname.startsWith(ADMIN_PREFIX)) {
    if (role === "SEGUIMIENTO") return NextResponse.next();
    if (role !== "ADMIN") {
      return NextResponse.redirect(new URL("/no-autorizado", request.url));
    }

    const restricted = session.user.restrictedAdminSections ?? [];
    // Gestor de encuestas (sin ninguna sección del panel): el Dashboard no le
    // aplica; su inicio es el módulo de encuestas.
    if (soloEncuestas(restricted)) {
      return NextResponse.redirect(new URL("/encuestas", request.url));
    }
    const matchedSection = ADMIN_SECTION_PREFIXES.find(([prefix]) => pathname.startsWith(prefix))?.[1];
    if (matchedSection && restricted.includes(matchedSection)) {
      return NextResponse.redirect(new URL("/no-autorizado", request.url));
    }
  }

  // Administrador con la sección ENCUESTAS restringida: tampoco entra por /encuestas.
  if (pathname.startsWith("/encuestas") && role === "ADMIN" && (session.user.restrictedAdminSections ?? []).includes("ENCUESTAS")) {
    return NextResponse.redirect(new URL("/no-autorizado", request.url));
  }

  if (pathname.startsWith(TUTOR_PREFIX) && role !== "ADMIN" && role !== "TUTOR") {
    return NextResponse.redirect(new URL("/no-autorizado", request.url));
  }

  return NextResponse.next();
});

export const config = {
  // Todo menos archivos estáticos: el corte de escrituras del rol de
  // seguimiento tiene que ver cada petición. Las reglas de sesión y rol
  // siguen aplicando solo a RUTAS_PROTEGIDAS.
  matcher: ["/((?!_next/static|_next/image|uploads/|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|woff2?|ttf|map|txt|xml)$).*)"],
};
