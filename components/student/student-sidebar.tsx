"use client";

import {
  Award,
  CalendarRange,
  Clapperboard,
  ClipboardCheck,
  Gavel,
  GraduationCap,
  Layers,
  LayoutDashboard,
  MessageSquareText,
  User,
} from "lucide-react";
import { AppSidebar, type GrupoNav } from "@/components/shell/app-sidebar";

/**
 * Menú del estudiante, agrupado por lo que la persona viene a hacer:
 *
 *  - Capacitaciones: a qué asistir, qué presentar y sus comités.
 *  - Cursos: lo que estudia a su ritmo y las constancias que eso le deja.
 *  - Participación: lo que respondió (y la videoteca, solo personal SIAU).
 *
 * Antes era un grupo «Mi expediente» con todo mezclado, y «Evaluaciones» y
 * «Mis encuestas» compartían el mismo ícono. Galardones ya no va aquí: la
 * convocatoria cerró (ver galardonesDisponiblePara).
 *
 * La Videoteca es solo del personal SIAU: lo decide el servidor
 * (lib/videoteca/acceso.ts) y llega como `verVideoteca`.
 */
const gruposPara = (verVideoteca: boolean): GrupoNav[] => [
  {
    label: null,
    items: [{ href: "/inicio", label: "Inicio", icon: LayoutDashboard, exact: true, hash: "" }],
  },
  {
    label: "Capacitaciones",
    items: [
      { href: "/mis-capacitaciones", label: "Mis capacitaciones", icon: CalendarRange },
      { href: "/evaluaciones", label: "Evaluaciones", icon: ClipboardCheck },
      { href: "/mis-comites", label: "Mis comités", icon: Gavel },
    ],
  },
  {
    label: "Cursos",
    items: [
      { href: "/mi-aula", label: "Mis cursos", icon: GraduationCap, exact: true, hash: "" },
      { href: "/cursos", label: "Catálogo", icon: Layers },
      { href: "/mis-certificados", label: "Mis constancias", icon: Award },
    ],
  },
  {
    label: "Participación",
    items: [
      { href: "/encuestas", label: "Mis encuestas", icon: MessageSquareText },
      ...(verVideoteca ? [{ href: "/videos", label: "Videoteca", icon: Clapperboard }] : []),
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
  verVideoteca = false,
}: {
  open: boolean;
  onClose: () => void;
  logoUrl?: string | null;
  verVideoteca?: boolean;
}) {
  return (
    <AppSidebar
      open={open}
      onClose={onClose}
      grupos={gruposPara(verVideoteca)}
      subtitulo="Campus virtual"
      logoUrl={logoUrl}
      claseAcento="accent-student"
    />
  );
}
