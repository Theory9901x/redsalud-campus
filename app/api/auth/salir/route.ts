import { NextResponse, type NextRequest } from "next/server";
import { signOut } from "@/auth";

/**
 * Cierre de sesión por formulario normal (POST). Vive bajo /api/auth para que
 * también funcione con los perfiles de solo lectura, a los que el proxy les
 * rechaza cualquier otra petición que no sea de lectura.
 */
export async function POST(request: NextRequest) {
  await signOut({ redirect: false });
  return NextResponse.redirect(new URL("/login", request.url), 303);
}
