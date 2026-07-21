"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, GraduationCap, Layers, Award, User, X, Activity, ClipboardList, CalendarRange } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/inicio", label: "Dashboard", icon: LayoutDashboard, match: "/inicio", hash: "", exact: true },
  { href: "/mi-aula", label: "Mis cursos", icon: GraduationCap, match: "/mi-aula", hash: "", exact: true },
  { href: "/cursos", label: "Catálogo", icon: Layers, match: "/cursos", hash: "", exact: false },
  {
    href: "/mi-aula#mis-certificados",
    label: "Mis certificados",
    icon: Award,
    match: "/mi-aula",
    hash: "#mis-certificados",
    exact: true,
  },
  {
    href: "/mis-capacitaciones",
    label: "Mis capacitaciones",
    icon: CalendarRange,
    match: "/mis-capacitaciones",
    hash: "",
    exact: false,
  },
  { href: "/mis-encuestas", label: "Mis encuestas", icon: ClipboardList, match: "/mis-encuestas", hash: "", exact: false },
  { href: "/perfil", label: "Perfil", icon: User, match: "/perfil", hash: "", exact: true },
];

export function StudentSidebar({
  open,
  onClose,
  logoUrl,
}: {
  open: boolean;
  onClose: () => void;
  logoUrl?: string | null;
}) {
  const pathname = usePathname();
  const [hash, setHash] = useState("");

  // usePathname() no incluye el fragmento (#...): sin esto, "Mis cursos" y
  // "Mis certificados" (ambos en /mi-aula) se marcarían activos a la vez.
  useEffect(() => {
    setHash(window.location.hash);
  }, [pathname]);

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

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
        {/* Resplandor de marca sutil, mismo tratamiento que el login/hero. */}
        <div className="pointer-events-none absolute -left-10 -top-16 h-56 w-56 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 -right-10 h-48 w-48 rounded-full bg-success/10 blur-3xl" />

        <div className="relative flex items-center gap-2.5 px-6 py-6">
          {logoUrl ? (
            <span className="flex shrink-0 items-center justify-center rounded-lg bg-white/95 p-1 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element -- logo institucional dinámico, no un asset estático conocido en build. */}
              <img src={logoUrl} alt="Red Salud Casanare E.S.E." className="h-7 w-auto object-contain" />
            </span>
          ) : (
            <Activity className="h-6 w-6 shrink-0 text-sidebar-primary" strokeWidth={2.5} />
          )}
          <p className="flex-1 font-display text-sm font-extrabold leading-tight text-white">
            RedSalud <span className="text-primary">Te Forma</span>
          </p>
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
            const isActive = item.exact
              ? pathname === item.match && hash === item.hash
              : pathname.startsWith(item.match);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => {
                  onClose();
                  setHash(item.hash);
                }}
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
