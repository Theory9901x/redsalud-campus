import { signOut } from "@/auth";

/**
 * Cierre de sesión por formulario normal (POST). Vive bajo /api/auth para que
 * también funcione con los perfiles de solo lectura, a los que el proxy les
 * rechaza cualquier otra petición que no sea de lectura.
 */
export async function POST() {
  await signOut({ redirect: false });
  // Ubicación relativa: detrás de nginx, request.url trae el host interno
  // (localhost) y el navegador terminaría en una página caída.
  return new Response(null, { status: 303, headers: { Location: "/login" } });
}
