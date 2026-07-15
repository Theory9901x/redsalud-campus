import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SiteHeader } from "@/components/public/site-header";
import { StudentShell } from "@/components/student/student-shell";
import { AdminShell } from "@/components/admin/admin-shell";
import { getUserAvatarUrl } from "@/lib/avatar";
import { getNotificationsForUser } from "@/lib/notifications";

/**
 * El catálogo es público (visitantes anónimos lo ven sin sesión), pero un
 * usuario ya logueado no debe "salir" de su dashboard al entrar aquí: pierde
 * el sidebar y se siente como si hubiera abandonado la plataforma. Por eso
 * este layout envuelve el mismo contenido en el shell de su rol (Student/Admin)
 * cuando hay sesión, y solo cae al header público para visitantes y tutores
 * (que no tienen un sidebar propio que preservar).
 */
export default async function CursosLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (session?.user.role === "STUDENT") {
    const [avatarUrl, settings, { notifications, unreadCount }, user] = await Promise.all([
      getUserAvatarUrl(session.user.id),
      prisma.institutionSettings.findUnique({ where: { id: "singleton" } }),
      getNotificationsForUser(session.user.id, session.user.role),
      prisma.user.findUnique({ where: { id: session.user.id }, select: { position: true } }),
    ]);

    return (
      <StudentShell
        userName={session.user.name ?? ""}
        avatarUrl={avatarUrl}
        logoUrl={settings?.logoUrl ?? null}
        notifications={notifications}
        unreadCount={unreadCount}
        position={user?.position ?? null}
        personnelType={session.user.personnelType}
      >
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      </StudentShell>
    );
  }

  if (session?.user.role === "ADMIN") {
    return (
      <AdminShell userName={session.user.name ?? "Administrador"} restrictedAdminSections={session.user.restrictedAdminSections}>
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </AdminShell>
    );
  }

  // Visitante anónimo y tutor (sin sidebar propio): header público flotante.
  // page-canvas: mismo nivel 0 (fondo frío, nunca blanco puro) que el área
  // de estudiante, para que los paneles de sección de arriba (nivel 1) y
  // las tarjetas de curso (nivel 2) se lean como elevados por contraste
  // real, no solo por un borde sutil sobre blanco plano.
  return (
    <div className="page-canvas relative min-h-screen">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 15% 0%, color-mix(in oklch, var(--primary) 18%, transparent), transparent 55%), radial-gradient(circle at 85% 10%, color-mix(in oklch, var(--success) 14%, transparent), transparent 45%)",
        }}
      />
      <div className="relative pb-20 pt-6">
        <SiteHeader />
        <main className="mx-auto mt-8 w-full max-w-5xl px-4">{children}</main>
      </div>
    </div>
  );
}
