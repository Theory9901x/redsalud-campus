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
  PieChart,
  Bell,
  Settings,
  Activity,
  ScrollText,
  CalendarRange,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdminSection } from "@prisma/client";

const NAV_ITEMS: { href: string; label: string; icon: typeof LayoutDashboard; exact?: boolean; section?: AdminSection }[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/usuarios", label: "Usuarios", icon: Users, section: "USUARIOS" },
  { href: "/admin/cursos", label: "Cursos", icon: BookOpen, section: "CURSOS" },
  { href: "/admin/planes-capacitacion", label: "Planes de capacitación", icon: CalendarRange, section: "PLANES_CAPACITACION" },
  { href: "/admin/inscripciones", label: "Inscripciones", icon: ClipboardList, section: "INSCRIPCIONES" },
  { href: "/admin/certificados", label: "Certificados", icon: Award, section: "CERTIFICADOS" },
  { href: "/admin/notificaciones", label: "Notificaciones", icon: Bell, section: "NOTIFICACIONES" },
  { href: "/admin/reportes/centro", label: "Centro de datos", icon: PieChart, section: "REPORTES" },
  { href: "/admin/reportes", label: "Reportes", icon: BarChart3, exact: true, section: "REPORTES" },
  { href: "/admin/bitacora", label: "Bitácora", icon: ScrollText, section: "REPORTES" },
  { href: "/admin/configuracion", label: "Configuración", icon: Settings, section: "CONFIGURACION" },
];

export function AdminSidebar({
  open,
  onClose,
  restrictedSections,
}: {
  open: boolean;
  onClose: () => void;
  restrictedSections: AdminSection[];
}) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => !item.section || !restrictedSections.includes(item.section));

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
        {/* Resplandor de marca detrás del logo, mismo tratamiento que el login/hero. */}
        <div className="pointer-events-none absolute -left-10 -top-16 h-56 w-56 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 -right-10 h-48 w-48 rounded-full bg-success/10 blur-3xl" />

        <div className="relative flex items-center gap-2 px-6 py-6">
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

        <nav className="relative flex-1 space-y-1.5 overflow-y-auto px-3">
          {items.map((item) => {
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
