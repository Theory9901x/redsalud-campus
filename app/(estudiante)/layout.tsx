import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { StudentShell } from "@/components/student/student-shell";
import { getUserAvatarUrl } from "@/lib/avatar";
import { getNotificationsForUser } from "@/lib/notifications";

export default async function EstudianteLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
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
