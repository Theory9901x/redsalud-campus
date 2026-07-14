"use client";

import { useState } from "react";
import { AdminSidebar } from "@/components/admin/sidebar";
import { AdminTopbar } from "@/components/admin/topbar";
import type { AdminSection } from "@prisma/client";

export function AdminShell({
  userName,
  restrictedAdminSections,
  children,
}: {
  userName: string;
  restrictedAdminSections: AdminSection[];
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <AdminSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        restrictedSections={restrictedAdminSections}
      />
      <div className="page-canvas flex min-w-0 flex-1 flex-col">
        <AdminTopbar userName={userName} onMenuClick={() => setSidebarOpen(true)} />
        <main className="min-w-0 flex-1 overflow-x-hidden p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
