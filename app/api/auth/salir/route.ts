import { cookies } from "next/headers";
import { COOKIE_SALIDA, signOut } from "@/auth";

/**
 * Cierre de sesión por formulario normal (POST). Vive bajo /api/auth para que
 * también funcione con los perfiles de solo lectura, a los que el proxy les
 * rechaza cualquier otra petición que no sea de lectura.
 */
export async function POST() {
  await signOut({ redirect: false });
  // Deja constancia del cierre: las respuestas de peticiones que seguían en
  // vuelo vuelven a poner la cookie de sesión, y sin esta marca la sesión
  // "resucitaba" (ver COOKIE_SALIDA en auth.ts). Dura más que la sesión (30 d).
  (await cookies()).set(COOKIE_SALIDA, String(Date.now()), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 40,
  });
  // Ubicación relativa: detrás de nginx, request.url trae el host interno
  // (localhost) y el navegador terminaría en una página caída.
  return new Response(null, { status: 303, headers: { Location: "/login" } });
}
