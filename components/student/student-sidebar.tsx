"use client";

import { Award, CalendarRange, ClipboardList, GraduationCap, Layers, LayoutDashboard, User } from "lucide-react";
import { AppSidebar, type GrupoNav } from "@/components/shell/app-sidebar";

const GRUPOS: GrupoNav[] = [
  {
    label: null,
    items: [
      { href: "/inicio", label: "Dashboard", icon: LayoutDashboard, exact: true, hash: "" },
      { href: "/mi-aula", label: "Mis cursos", icon: GraduationCap, exact: true, hash: "" },
      { href: "/cursos", label: "Catálogo", icon: Layers },
    ],
  },
  {
    label: "Mi expediente",
    items: [
      {
        href: "/mi-aula#mis-certificados",
        label: "Mis certificados",
        icon: Award,
        match: "/mi-aula",
        hash: "#mis-certificados",
      },
      { href: "/mis-capacitaciones", label: "Mis capacitaciones", icon: CalendarRange },
      { href: "/mis-encuestas", label: "Mis encuestas", icon: ClipboardList },
    ],
  },
  {
    label: "Cuenta",
    items: [{ href: "/perfil", label: "Perfil", icon: User, exact: true, hash: "" }],
  },
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
  return (
    <AppSidebar
      open={open}
      onClose={onClose}
      grupos={GRUPOS}
      subtitulo="Campus virtual"
      logoUrl={logoUrl}
      claseAcento="accent-student"
      pie={{
        titulo: "Tu formación queda certificada",
        texto: "Cada curso aprobado genera un certificado verificable con código QR.",
      }}
    />
  );
}
