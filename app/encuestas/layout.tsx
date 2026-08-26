import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AdminShell } from "@/components/admin/admin-shell";
import { TutorShell } from "@/components/tutor/tutor-shell";
import { StudentShell } from "@/components/student/student-shell";
import { getUserAvatarUrl } from "@/lib/avatar";
import { getNotificationsForUser } from "@/lib/notifications";

/**
 * El módulo de encuestas vive DENTRO del entorno principal: cada rol lo ve
 * envuelto en su propio shell (sidebar + topbar), no como página aislada.
 * La única puerta que sigue aislada a propósito es /e/[slug], la pública.
 */
export default async function EncuestasLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  if (session.user.role === "ADMIN") {
    return (
      <AdminShell
        userName={session.user.name ?? "Administrador"}
        restrictedAdminSections={session.user.restrictedAdminSections}
      >
        {children}
      </AdminShell>
    );
  }

  if (session.user.role === "TUTOR") {
    return <TutorShell userName={session.user.name ?? "Tutor"}>{children}</TutorShell>;
  }

  // Estudiante: su shell pide avatar, logo y notificaciones (igual que en
  // app/(estudiante)/layout.tsx).
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
      {children}
    </StudentShell>
  );
}
