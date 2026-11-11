"use client";

import { Award, CalendarRange, Clapperboard, ClipboardList, Gavel, GraduationCap, Layers, LayoutDashboard, Trophy, User } from "lucide-react";
import { AppSidebar, type GrupoNav } from "@/components/shell/app-sidebar";

const GRUPOS: GrupoNav[] = [
  {
    label: null,
    items: [
      { href: "/inicio", label: "Dashboard", icon: LayoutDashboard, exact: true, hash: "" },
      // Arriba a propósito: al final del menú quedaba tapado por el pie en
      // pantallas de portátil y los colaboradores no lo encontraban.
      { href: "/galardones", label: "Galardones", icon: Trophy },
      { href: "/mi-aula", label: "Mis cursos", icon: GraduationCap, exact: true, hash: "" },
      { href: "/cursos", label: "Catálogo", icon: Layers },
    ],
  },
  {
    label: "Mi expediente",
    items: [
      { href: "/mis-certificados", label: "Mis constancias", icon: Award },
      { href: "/mis-capacitaciones", label: "Mis capacitaciones", icon: CalendarRange },
      { href: "/videos", label: "Videoteca", icon: Clapperboard },
      { href: "/mis-comites", label: "Mis comités", icon: Gavel },
      { href: "/evaluaciones", label: "Evaluaciones", icon: ClipboardList },
      { href: "/encuestas", label: "Mis encuestas", icon: ClipboardList },
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
    />
  );
}
