"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  CalendarRange,
  Award,
  Layers,
  LayoutDashboard,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminTopbar } from "@/components/admin/topbar";
import { AppSidebar, type GrupoNav } from "@/components/shell/app-sidebar";

/**
 * Identidad del área tutor (Fase 6.0): espacio de TRABAJO, no aula. Navy más
 * profundo, verde éxito como color principal del rol, badge "TUTOR"
 * permanente y franja de acento superior que distingue el área a simple
 * vista. Misma familia visual que el resto del chrome, distinta firma.
 */
const NAV_GROUPS: GrupoNav[] = [
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
    items: [{ href: "/cursos", label: "Catálogo institucional", icon: Layers }],
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
    <div className="accent-tutor flex min-h-screen">
      <AppSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        grupos={NAV_GROUPS}
        subtitulo="Espacio de tutor"
        claseAcento="accent-tutor"
        pie={{
          titulo: "Tus cursos, tu seguimiento",
          texto: "Aquí ves quién avanza, quién se quedó y a quién hay que empujar.",
        }}
      />
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
        <main className="mx-auto w-full min-w-0 max-w-[1600px] flex-1 overflow-x-hidden p-4 sm:p-6">{children}</main>
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
