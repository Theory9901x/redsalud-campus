"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import { AdminSidebar } from "@/components/admin/sidebar";
import { AdminTopbar } from "@/components/admin/topbar";
import type { AdminSection } from "@prisma/client";

export function AdminShell({
  userName,
  restrictedAdminSections,
  soloLectura = false,
  children,
}: {
  userName: string;
  restrictedAdminSections: AdminSection[];
  /** Rol SEGUIMIENTO (Control Interno): todo visible, nada editable. */
  soloLectura?: boolean;
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="accent-admin flex min-h-screen" data-solo-lectura={soloLectura || undefined}>
      <AdminSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        restrictedSections={restrictedAdminSections}
      />
      <div className="page-canvas flex min-w-0 flex-1 flex-col">
        <AdminTopbar userName={userName} roleLabel={soloLectura ? "Control Interno · solo lectura" : undefined} onMenuClick={() => setSidebarOpen(true)} />
        {soloLectura && (
          <div className="aviso-solo-lectura" role="status">
            <Eye className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              <b>Modo seguimiento · Control Interno.</b> Puedes consultar todo el panel, sus métricas e informes; no se puede
              crear, editar ni eliminar nada.
            </span>
          </div>
        )}
        <main className="mx-auto w-full min-w-0 max-w-[1600px] flex-1 overflow-x-hidden p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
