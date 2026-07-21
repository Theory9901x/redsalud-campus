"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  BookOpen,
  CalendarRange,
  Award,
  Layers,
  LayoutDashboard,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminTopbar } from "@/components/admin/topbar";

/**
 * Identidad del área tutor (Fase 6.0): espacio de TRABAJO, no aula. Navy más
 * profundo, verde éxito como color principal del rol, badge "TUTOR"
 * permanente y franja de acento superior que distingue el área a simple
 * vista. Misma familia visual que el resto del chrome, distinta firma.
 */
const NAV_GROUPS: {
  label: string | null;
  items: { href: string; label: string; icon: typeof LayoutDashboard; exact?: boolean; external?: boolean }[];
}[] = [
  {
    label: null,
    items: [{ href: "/tutor", label: "Panel", icon: LayoutDashboard, exact: true }],
  },
  {
    label: "Contenido",
    items: [
      { href: "/tutor/cursos", label: "Mis cursos", icon: BookOpen },
      { href: "/tutor/planes-capacitacion", label: "Planes de capacitación", icon: CalendarRange },
    ],
  },
  {
    label: "Personas",
    items: [
      { href: "/tutor/inscritos", label: "Inscritos y progreso", icon: Users },
      { href: "/tutor/certificados", label: "Certificados", icon: Award },
    ],
  },
  {
    label: "Explorar",
    items: [{ href: "/cursos", label: "Catálogo institucional", icon: Layers, external: true }],
  },
];

const BREADCRUMBS: [string, string][] = [
  ["/tutor/cursos", "Contenido · Mis cursos"],
  ["/tutor/planes-capacitacion", "Contenido · Planes de capacitación"],
  ["/tutor/inscritos", "Personas · Inscritos y progreso"],
  ["/tutor/certificados", "Personas · Certificados"],
  ["/cursos", "Explorar · Catálogo institucional"],
  ["/tutor", "Panel"],
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
          "fixed inset-y-0 left-0 z-50 flex h-screen w-[260px] shrink-0 flex-col overflow-hidden border-r border-white/10 bg-gradient-to-b from-[#0B1826] to-[#050D16] text-sidebar-foreground transition-transform duration-200 lg:sticky lg:top-0 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Resplandor verde del rol detrás del logo. */}
        <div className="pointer-events-none absolute -left-10 -top-16 h-56 w-56 rounded-full bg-success/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 -right-10 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />

        <div className="relative flex items-center gap-2 px-5 py-6">
          <Activity className="h-6 w-6 shrink-0 text-success" strokeWidth={2.5} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-sm font-extrabold leading-none text-white">
              RedSalud Te Forma
            </p>
            <span className="mt-1.5 inline-flex items-center rounded-full border border-success/40 bg-success/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-success backdrop-blur">
              Tutor
            </span>
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

        <nav className="relative flex-1 space-y-4 overflow-y-auto px-3 pb-4">
          {NAV_GROUPS.map((group, groupIndex) => (
            <div key={group.label ?? "panel"} className={cn(groupIndex > 0 && "border-t border-white/10 pt-3")}>
              {group.label && (
                <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-sidebar-foreground/40">
                  {group.label}
                </p>
              )}
              <div className="space-y-1">
                {group.items.map((item) => {
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
                          ? "bg-gradient-to-r from-success to-success/70 text-white shadow-md shadow-success/30"
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
              </div>
            </div>
          ))}
        </nav>

        <div className="relative border-t border-white/10 px-5 py-4 text-xs text-sidebar-foreground/40">
          Red Salud Casanare E.S.E.
        </div>
      </aside>
    </>
  );
}

export function TutorShell({
  userName,
  banner,
  children,
}: {
  userName: string;
  /** Banner discreto sobre el contenido (p. ej. "Estás viendo el catálogo como tutor"). */
  banner?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const breadcrumb = BREADCRUMBS.find(([prefix]) => pathname.startsWith(prefix))?.[1] ?? "Panel";

  return (
    <div className="flex min-h-screen">
      <TutorSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="page-canvas flex min-w-0 flex-1 flex-col">
        {/* Franja de acento del área tutor: verde -> azul, siempre visible. */}
        <div className="h-[3px] shrink-0 bg-gradient-to-r from-success to-primary" />
        <AdminTopbar
          userName={userName}
          roleLabel="Tutor"
          breadcrumb={breadcrumb}
          onMenuClick={() => setSidebarOpen(true)}
        />
        {banner}
        <main className="min-w-0 flex-1 overflow-x-hidden p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

/** Banner "estás navegando fuera del panel" para el catálogo con chrome de tutor. */
export function TutorContextBanner() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-success/20 bg-success/10 px-4 py-2 text-sm text-foreground/80 sm:px-6">
      <span>
        Estás viendo el catálogo institucional <strong>como tutor</strong>.
      </span>
      <Link
        href="/tutor"
        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold text-success transition-colors hover:bg-success/15"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Volver a mi panel
      </Link>
    </div>
  );
}
