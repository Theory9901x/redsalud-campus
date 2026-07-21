"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, BookOpen, CalendarRange, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminTopbar } from "@/components/admin/topbar";

const NAV_ITEMS = [
  { href: "/tutor", label: "Mis cursos", icon: BookOpen, exact: true },
  { href: "/tutor/planes-capacitacion", label: "Planes de capacitación", icon: CalendarRange, exact: false },
];

function TutorSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-navy/40 backdrop-blur-sm lg:hidden" onClick={onClose} aria-hidden="true" />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-screen w-64 shrink-0 flex-col overflow-hidden border-r border-white/10 bg-gradient-to-b from-sidebar to-[#0A1622] text-sidebar-foreground transition-transform duration-200 lg:sticky lg:top-0 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="pointer-events-none absolute -left-10 -top-16 h-56 w-56 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 -right-10 h-48 w-48 rounded-full bg-success/10 blur-3xl" />

        <div className="relative flex items-center gap-2 px-6 py-6">
          <Activity className="h-6 w-6 text-sidebar-primary" strokeWidth={2.5} />
          <div className="flex-1">
            <p className="font-display text-base font-extrabold leading-none text-white">RedSalud Te Forma</p>
            <p className="mt-1 text-xs text-sidebar-foreground/60">Panel del tutor</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sidebar-foreground/60 hover:text-white lg:hidden"
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="relative flex-1 space-y-1.5 px-3">
          {NAV_ITEMS.map((item) => {
            const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-gradient-to-r from-primary to-primary/70 text-white shadow-md shadow-primary/30"
                    : "text-sidebar-foreground/70 hover:translate-x-0.5 hover:bg-white/5 hover:text-white"
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors",
                    isActive ? "bg-white/20" : "bg-white/5 group-hover:bg-white/10"
                  )}
                >
                  <Icon className="h-4 w-4" strokeWidth={2} />
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="relative border-t border-white/10 px-6 py-4 text-xs text-sidebar-foreground/40">
          Red Salud Casanare E.S.E.
        </div>
      </aside>
    </>
  );
}

/** Shell del tutor: mismo lenguaje (sidebar navy + topbar glass) que admin y estudiante. */
export function TutorShell({ userName, children }: { userName: string; children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <TutorSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="page-canvas flex min-w-0 flex-1 flex-col">
        <AdminTopbar userName={userName} roleLabel="Tutor" onMenuClick={() => setSidebarOpen(true)} />
        <main className="min-w-0 flex-1 overflow-x-hidden p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
