import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { veComoAdmin } from "@/lib/roles";
import { StudentShell } from "@/components/student/student-shell";
import { AdminShell } from "@/components/admin/admin-shell";
import { TutorShell } from "@/components/tutor/tutor-shell";
import { getUserAvatarUrl } from "@/lib/avatar";
import { getNotificationsForUser } from "@/lib/notifications";

/**
 * Las páginas del personal (mis capacitaciones, evaluaciones, constancias,
 * perfil…) se abren envueltas en el entorno del ROL de quien navega, no en
 * uno fijo: un tutor o un administrador que llega aquí -por un QR, un aviso
 * o el panel en vivo- conserva su menú y su panel, y nunca "se vuelve
 * estudiante" por haber abierto una de estas rutas.
 */
export default async function EstudianteLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  if (veComoAdmin(session.user.role)) {
    return (
      <AdminShell
        userName={session.user.name ?? "Administrador"}
        restrictedAdminSections={session.user.restrictedAdminSections}
        soloLectura={session.user.role === "SEGUIMIENTO"}
      >
        {children}
      </AdminShell>
    );
  }

  if (session.user.role === "TUTOR") {
    return <TutorShell userName={session.user.name ?? "Tutor"}>{children}</TutorShell>;
  }

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
