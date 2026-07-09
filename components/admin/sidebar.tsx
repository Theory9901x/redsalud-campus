"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  ClipboardList,
  Award,
  BarChart3,
  Bell,
  Settings,
  Activity,
  CalendarRange,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/usuarios", label: "Usuarios", icon: Users },
  { href: "/admin/cursos", label: "Cursos", icon: BookOpen },
  { href: "/admin/planes-capacitacion", label: "Planes de capacitación", icon: CalendarRange },
  { href: "/admin/inscripciones", label: "Inscripciones", icon: ClipboardList },
  { href: "/admin/certificados", label: "Certificados", icon: Award },
  { href: "/admin/notificaciones", label: "Notificaciones", icon: Bell },
  { href: "/admin/reportes", label: "Reportes", icon: BarChart3 },
  { href: "/admin/configuracion", label: "Configuración", icon: Settings },
];

export function AdminSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={onClose} aria-hidden="true" />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-screen w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-transform duration-200 lg:sticky lg:top-0 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center gap-2 px-6 py-6">
          <Activity className="h-6 w-6 text-sidebar-primary" strokeWidth={2.5} />
          <div className="flex-1">
            <p className="font-display text-base font-extrabold leading-none text-white">
              RedSalud Te Forma
            </p>
            <p className="mt-1 text-xs text-sidebar-foreground/60">Panel administrativo</p>
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

        <nav className="flex-1 space-y-1 px-3">
          {NAV_ITEMS.map((item) => {
            const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-white"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-white"
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={2} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-6 py-4 text-xs text-sidebar-foreground/40">
          Red Salud Casanare E.S.E.
        </div>
      </aside>
    </>
  );
}
