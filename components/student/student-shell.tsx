"use client";

import { useState } from "react";
import { StudentSidebar } from "@/components/student/student-sidebar";
import { StudentHeader } from "@/components/student/student-header";
import type { NotificationItem } from "@/components/student/notification-bell";
import type { PersonnelType } from "@prisma/client";

export function StudentShell({
  userName,
  avatarUrl,
  logoUrl,
  notifications,
  unreadCount,
  position,
  personnelType,
  children,
}: {
  userName: string;
  avatarUrl?: string | null;
  logoUrl?: string | null;
  notifications: NotificationItem[];
  unreadCount: number;
  position?: string | null;
  personnelType: PersonnelType;
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <StudentSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} logoUrl={logoUrl} />
      <div className="page-canvas flex min-w-0 flex-1 flex-col">
        <StudentHeader
          userName={userName}
          avatarUrl={avatarUrl}
          notifications={notifications}
          unreadCount={unreadCount}
          position={position}
          personnelType={personnelType}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="min-w-0 flex-1 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
