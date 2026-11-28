"use server";

import { cookies } from "next/headers";
import { COOKIE_SALIDA, signOut } from "@/auth";

export async function signOutAction() {
  // Misma marca de cierre que /api/auth/salir (ver COOKIE_SALIDA en auth.ts).
  (await cookies()).set(COOKIE_SALIDA, String(Date.now()), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 40,
  });
  await signOut({ redirectTo: "/login" });
}
