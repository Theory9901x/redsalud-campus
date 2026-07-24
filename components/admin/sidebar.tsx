"use client";

import {
  Award,
  BarChart3,
  Bell,
  BookOpen,
  CalendarRange,
  ClipboardList,
  LayoutDashboard,
  PieChart,
  ScrollText,
  Settings,
  Users,
} from "lucide-react";
import { AppSidebar, type GrupoNav, type ItemNav } from "@/components/shell/app-sidebar";
import type { AdminSection } from "@prisma/client";

/**
 * La sección sirve para ocultarle a un administrador limitado lo que no le
 * corresponde. Va junto al ítem, no en una lista aparte, para que agregar una
 * pantalla nueva no implique acordarse de tocar dos sitios.
 */
type ItemAdmin = ItemNav & { section?: AdminSection };

const GRUPOS: { label: string | null; items: ItemAdmin[] }[] = [
  {
    label: null,
    items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true }],
  },
  {
    label: "Personas",
    items: [
      { href: "/admin/usuarios", label: "Usuarios", icon: Users, section: "USUARIOS" },
      { href: "/admin/inscripciones", label: "Inscripciones", icon: ClipboardList, section: "INSCRIPCIONES" },
      { href: "/admin/certificados", label: "Certificados", icon: Award, section: "CERTIFICADOS" },
    ],
  },
  {
    label: "Formación",
    items: [
      { href: "/admin/cursos", label: "Cursos", icon: BookOpen, section: "CURSOS" },
      {
        href: "/admin/planes-capacitacion",
        label: "Planes de capacitación",
        icon: CalendarRange,
        section: "PLANES_CAPACITACION",
      },
      { href: "/admin/notificaciones", label: "Notificaciones", icon: Bell, section: "NOTIFICACIONES" },
    ],
  },
  {
    label: "Seguimiento",
    items: [
      { href: "/admin/reportes/centro", label: "Centro de datos", icon: PieChart, section: "REPORTES" },
      { href: "/admin/reportes", label: "Reportes", icon: BarChart3, exact: true, section: "REPORTES" },
      { href: "/admin/bitacora", label: "Bitácora", icon: ScrollText, section: "REPORTES" },
    ],
  },
  {
    label: "Sistema",
    items: [{ href: "/admin/configuracion", label: "Configuración", icon: Settings, section: "CONFIGURACION" }],
  },
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
  // Un grupo que se queda sin ítems visibles no debe dejar su título huérfano.
  const grupos: GrupoNav[] = GRUPOS.map((g) => ({
    label: g.label,
    items: g.items.filter((item) => !item.section || !restrictedSections.includes(item.section)),
  })).filter((g) => g.items.length > 0);

  return (
    <AppSidebar
      open={open}
      onClose={onClose}
      grupos={grupos}
      subtitulo="Panel administrativo"
      claseAcento="accent-admin"
      pie={{
        titulo: "Todo movimiento queda registrado",
        texto: "Cada cambio en la plataforma se guarda en la bitácora, con quién y cuándo.",
      }}
    />
  );
}
