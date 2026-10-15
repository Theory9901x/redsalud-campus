import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AdminShell } from "@/components/admin/admin-shell";
import { veComoAdmin } from "@/lib/roles";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user || !veComoAdmin(session.user.role)) {
    redirect("/login");
  }

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
