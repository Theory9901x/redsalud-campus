"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  CalendarRange,
  ClipboardCheck,
  LayoutDashboard,
  MessageSquareText,
  PieChart,
  Radio,
  Users,
} from "lucide-react";
import { AdminTopbar } from "@/components/admin/topbar";
import { AppSidebar, type GrupoNav } from "@/components/shell/app-sidebar";

/**
 * Identidad del área tutor (Fase 6.0): espacio de TRABAJO, no aula. Navy más
 * profundo, verde éxito como color principal del rol, badge "TUTOR"
 * permanente y franja de acento superior que distingue el área a simple
 * vista. Misma familia visual que el resto del chrome, distinta firma.
 *
 * El tutor es un ÁREA con capacitaciones estipuladas en el Plan
 * Institucional de Capacitaciones (lo genera Talento Humano en concertación
 * con los procesos). Su menú es solo eso: el PLAN de su área -sus
 * capacitaciones, lo que evalúa y la satisfacción que quiera medir- y las
 * PERSONAS que participan en ellas. Sin cursos, catálogo ni constancias: las
 * áreas no revisan inducción/reinducción y el plan no genera constancias.
 */
const NAV_GROUPS: GrupoNav[] = [
  {
    label: null,
    items: [{ href: "/tutor", label: "Centro de mando", icon: LayoutDashboard, exact: true }],
  },
  {
    label: "Plan de capacitación",
    items: [
      { href: "/tutor/planes-capacitacion", label: "Planes de capacitación", icon: CalendarRange, excluir: ["/tutor/planes-capacitacion/en-vivo"] },
      { href: "/tutor/capacitaciones/nueva", label: "Crear capacitación", icon: CalendarRange },
      { href: "/tutor/reuniones", label: "Mis reuniones", icon: CalendarRange },
      { href: "/tutor/planes-capacitacion/en-vivo", label: "En vivo", icon: Radio },
      // Vista de OBSERVACIÓN, no de acción: el tutor abre las ventanas del
      // ciclo, no las presenta, así que aquí ve en vivo quién está
      // presentando y quién terminó -no la pantalla del estudiante-.
      { href: "/tutor/mis-encuestas", label: "Evaluaciones en vivo", icon: ClipboardCheck },
      // Solo las encuestas de satisfacción de sus capacitaciones (nunca la SIAU,
      // salvo para la cuenta del área SIAU).
      { href: "/encuestas", label: "Encuestas", icon: MessageSquareText, excluir: ["/encuestas/siau"] },
    ],
  },
  {
    label: "Personas",
    items: [{ href: "/tutor/inscritos", label: "Participantes", icon: Users }],
  },
];

/**
 * Solo para la cuenta del área de Atención al Usuario: su Centro de datos.
 * Quién es esa cuenta lo decide el servidor (lib/encuestas/acceso-siau.ts)
 * y llega aquí como `cuentaSiau`; el cliente no consulta nada.
 */
const GRUPO_SIAU: GrupoNav = {
  label: "Atención al Usuario",
  items: [{ href: "/encuestas/siau", label: "Centro de datos SIAU", icon: PieChart }],
};
const NAV_GROUPS_SIAU: GrupoNav[] = [...NAV_GROUPS.slice(0, 2), GRUPO_SIAU, ...NAV_GROUPS.slice(2)];

const BREADCRUMBS: [string, string][] = [
  ["/tutor/capacitaciones/nueva", "Crear capacitación de mi área"],
  ["/tutor/planes-capacitacion/en-vivo", "Plan · En vivo"],
  ["/tutor/planes-capacitacion", "Plan · Planes de capacitación"],
  ["/tutor/mis-encuestas", "Plan · Evaluaciones en vivo"],
  ["/encuestas/siau", "Atención al Usuario · Centro de datos SIAU"],
  ["/encuestas", "Plan · Encuestas"],
  ["/tutor/inscritos", "Personas · Participantes"],
  ["/tutor", "Centro de mando"],
];

export function TutorShell({
  userName,
  cuentaSiau = false,
  banner,
  children,
}: {
  userName: string;
  /** Es la cuenta del área SIAU: suma al menú el Centro de datos SIAU. */
  cuentaSiau?: boolean;
  /** Banner discreto sobre el contenido (p. ej. "Estás viendo el catálogo como tutor"). */
  banner?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const breadcrumb = BREADCRUMBS.find(([prefix]) => pathname.startsWith(prefix))?.[1] ?? "Centro de mando";

  return (
    <div className="accent-tutor flex min-h-screen">
      <AppSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        grupos={cuentaSiau ? NAV_GROUPS_SIAU : NAV_GROUPS}
        subtitulo="Espacio de tutor"
        claseAcento="accent-tutor"
        // Sin tarjeta de pie: con ocho entradas se montaba sobre el menú en
        // pantallas de 900 px de alto.
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
        <main className="tutor-workspace mx-auto w-full min-w-0 max-w-[1600px] flex-1 overflow-x-hidden p-4 sm:p-6">{children}</main>
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
