import { asegurarInduccion } from "@/lib/induccion";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { AdminSection, PersonnelType, Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

declare module "next-auth" {
  interface User {
    role: Role;
    mustChangePassword: boolean;
    personnelType: PersonnelType;
    restrictedAdminSections: AdminSection[];
  }
  interface Session {
    user: {
      id: string;
      role: Role;
      mustChangePassword: boolean;
      personnelType: PersonnelType;
      restrictedAdminSections: AdminSection[];
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    role: Role;
    mustChangePassword: boolean;
    personnelType: PersonnelType;
    restrictedAdminSections: AdminSection[];
    revalidatedAt: number;
    /** Momento del acceso que creó esta sesión (ms). Ver COOKIE_SALIDA. */
    inicioAt?: number;
  }
}

/**
 * Marca del último cierre de sesión en este navegador (ms).
 *
 * Cada respuesta que pasa por el proxy RENUEVA la cookie de sesión. Si al
 * pulsar "Salir" todavía hay peticiones en vuelo (el panel precarga decenas
 * de enlaces al abrir), sus respuestas llegan después del cierre y vuelven a
 * poner la cookie: la persona creía haber salido y la sesión seguía viva.
 * Con esta marca, una sesión iniciada ANTES del último cierre se descarta
 * aunque su cookie reaparezca.
 */
export const COOKIE_SALIDA = "rs_salida";

async function ultimaSalida(request: NextRequest | undefined): Promise<number> {
  try {
    const valor = request ? request.cookies.get(COOKIE_SALIDA)?.value : (await cookies()).get(COOKIE_SALIDA)?.value;
    return Number(valor) || 0;
  } catch {
    // Fuera de una petición (scripts, build): no hay cookie que leer.
    return 0;
  }
}

// El identificador puede ser el correo o el "usuario" (nombre.apellido) que
// se asigna al personal sin un correo propio válido. Por eso no se valida como
// email: se acepta cualquier cadena no vacía y se resuelve contra ambos campos.
const credentialsSchema = z.object({
  email: z.string().trim().min(1),
  password: z.string().min(1),
});

// Ventana de tolerancia antes de volver a consultar el estado real del usuario en BD.
// Evita una consulta en cada request, pero acota qué tan "viejo" puede estar un rol/estado
// desactualizado en la sesión (revocaciones, desactivaciones) a como máximo este intervalo.
const REVALIDATE_INTERVAL_MS = 60_000;

export const { handlers, auth, signIn, signOut } = NextAuth((request) => ({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "credenciales",
      credentials: {
        email: { label: "Correo", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(rawCredentials) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;
        const { email: identificador, password } = parsed.data;

        // Acepta correo o usuario, SIN distinguir mayúsculas. Se compara con
        // `mode: "insensitive"` en vez de bajar el input a minúsculas, porque
        // el valor GUARDADO puede tener mayúsculas (cuentas creadas antes de
        // que el formulario normalizara el correo). Bajar solo el input dejaba
        // fuera del acceso a esas personas aunque su contraseña fuera correcta.
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { email: { equals: identificador, mode: "insensitive" } },
              { username: { equals: identificador, mode: "insensitive" } },
            ],
          },
        });
        if (!user || user.status !== "ACTIVE") return null;

        const passwordMatches = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatches) return null;

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });
        // Red de seguridad: las cuentas creadas por carga masiva también quedan
        // con el curso de inducción y reinducción al entrar (lib/induccion.ts).
        await asegurarInduccion(user.id).catch(() => 0);

        return {
          id: user.id,
          email: user.email,
          name: user.fullName,
          role: user.role,
          mustChangePassword: user.mustChangePassword,
          personnelType: user.personnelType,
          restrictedAdminSections: user.restrictedAdminSections,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.mustChangePassword = user.mustChangePassword;
        token.personnelType = user.personnelType;
        token.restrictedAdminSections = user.restrictedAdminSections;
        token.revalidatedAt = Date.now();
        token.inicioAt = Date.now();
        return token;
      }

      // Sesión anterior al último "Salir" de este navegador: no vale.
      const salida = await ultimaSalida(request);
      if (salida && (token.inicioAt ?? 0) <= salida) {
        return null;
      }

      const revalidatedAt = token.revalidatedAt ?? 0;
      if (Date.now() - revalidatedAt < REVALIDATE_INTERVAL_MS) {
        return token;
      }

      const dbUser = await prisma.user.findUnique({ where: { id: token.sub } });
      if (!dbUser || dbUser.status !== "ACTIVE") {
        return null;
      }

      token.role = dbUser.role;
      token.mustChangePassword = dbUser.mustChangePassword;
      token.personnelType = dbUser.personnelType;
      token.restrictedAdminSections = dbUser.restrictedAdminSections;
      token.revalidatedAt = Date.now();
      return token;
    },
    session({ session, token }) {
      session.user.id = token.sub!;
      session.user.role = token.role;
      session.user.mustChangePassword = token.mustChangePassword;
      session.user.personnelType = token.personnelType;
      session.user.restrictedAdminSections = token.restrictedAdminSections;
      return session;
    },
  },
}));
