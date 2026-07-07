import { NextResponse } from "next/server";
import { auth } from "@/auth";
import type { Role } from "@prisma/client";

const ADMIN_PREFIX = "/admin";
const TUTOR_PREFIX = "/tutor";

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

  if (pathname.startsWith(ADMIN_PREFIX) && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/no-autorizado", request.url));
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
    "/login",
    "/registro",
  ],
};
