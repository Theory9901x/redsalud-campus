import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { AdminSection, PersonnelType, Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

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

export const { handlers, auth, signIn, signOut } = NextAuth({
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

        // Acepta correo o usuario, sin distinguir mayúsculas en el correo.
        const user = await prisma.user.findFirst({
          where: { OR: [{ email: identificador.toLowerCase() }, { username: identificador.toLowerCase() }] },
        });
        if (!user || user.status !== "ACTIVE") return null;

        const passwordMatches = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatches) return null;

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

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
        return token;
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
});
