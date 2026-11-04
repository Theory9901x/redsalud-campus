"use client";

import { Award, CalendarRange, Clapperboard, ClipboardList, Gavel, GraduationCap, Layers, LayoutDashboard, Trophy, User } from "lucide-react";
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
      { href: "/mis-certificados", label: "Mis constancias", icon: Award },
      { href: "/mis-capacitaciones", label: "Mis capacitaciones", icon: CalendarRange },
      { href: "/videos", label: "Videoteca", icon: Clapperboard },
      { href: "/mis-comites", label: "Mis comités", icon: Gavel },
      { href: "/evaluaciones", label: "Evaluaciones", icon: ClipboardList },
      { href: "/encuestas", label: "Mis encuestas", icon: ClipboardList },
    ],
  },
  {
    label: "Reconocimiento",
    items: [{ href: "/galardones", label: "Galardones", icon: Trophy }],
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
        titulo: "Tu formación queda registrada",
        texto: "Cada curso aprobado genera una constancia verificable con código QR.",
      }}
    />
  );
}
