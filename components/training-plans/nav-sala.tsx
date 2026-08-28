"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Home,
  PhoneCall,
  Users,
  MessageCircle,
  CircleDot,
  Files,
  Settings,
  HelpCircle,
  ArrowRight,
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EVENTO_COMANDO_SALA, type ComandoSala } from "@/components/training-plans/sala-virtual";

type Item =
  | { clave: string; etiqueta: string; icono: React.ComponentType<{ className?: string }>; ancla: string }
  | { clave: string; etiqueta: string; icono: React.ComponentType<{ className?: string }>; comando: ComandoSala }
  | { clave: string; etiqueta: string; icono: React.ComponentType<{ className?: string }>; href: string };

/**
 * Barra lateral de la SALA: navega dentro de la misma página (anclas) o
 * manda comandos a la videollamada (chat, configuración). No recarga nada:
 * la llamada nunca se interrumpe por moverse por el módulo.
 */
export function NavSala({ archivosHref, conGrabacion }: { archivosHref: string; conGrabacion: boolean }) {
  const [activo, setActivo] = useState("llamada");

  const items: Item[] = [
    { clave: "resumen", etiqueta: "Resumen", icono: Home, ancla: "informe" },
    { clave: "llamada", etiqueta: "Llamada", icono: PhoneCall, ancla: "llamada" },
    { clave: "participantes", etiqueta: "Participantes", icono: Users, ancla: "participantes" },
    { clave: "chat", etiqueta: "Chat", icono: MessageCircle, comando: "enfocarChat" },
    ...(conGrabacion
      ? [{ clave: "grabaciones", etiqueta: "Grabaciones", icono: CircleDot, ancla: "grabacion" } as Item]
      : []),
    { clave: "archivos", etiqueta: "Archivos", icono: Files, href: archivosHref },
    { clave: "configuracion", etiqueta: "Configuración", icono: Settings, comando: "abrirConfiguracion" },
  ];

  function activar(item: Item) {
    setActivo(item.clave);
    if ("ancla" in item) {
      document.getElementById(item.ancla)?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if ("comando" in item) {
      window.dispatchEvent(new CustomEvent(EVENTO_COMANDO_SALA, { detail: { tipo: item.comando } }));
    }
  }

  return (
    <aside className="surface-glass flex h-full flex-col p-4 lg:sticky lg:top-6">
      <div className="mb-5 flex items-center gap-3 px-1">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-primary to-success text-white shadow-lg shadow-primary/30">
          <Video className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="font-display text-[13px] font-extrabold leading-tight text-foreground">Sala de reunión</p>
          <p className="text-[11px] text-muted-foreground">RedSalud Te Forma</p>
        </div>
      </div>

      <nav aria-label="Secciones de la sala" className="space-y-1">
        {items.map((item) => {
          const clases = cn(
            "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-semibold transition-colors",
            activo === item.clave
              ? "bg-primary/12 text-primary shadow-sm"
              : "text-muted-foreground hover:bg-card/70 hover:text-foreground"
          );
          if ("href" in item) {
            return (
              <Link key={item.clave} href={item.href} target="_blank" className={clases}>
                <item.icono className="h-4 w-4" />
                {item.etiqueta}
              </Link>
            );
          }
          return (
            <button key={item.clave} type="button" onClick={() => activar(item)} className={clases}>
              <item.icono className="h-4 w-4" />
              {item.etiqueta}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto rounded-2xl border border-border/50 bg-card/60 p-4">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/12 text-primary">
          <HelpCircle className="h-4 w-4" aria-hidden="true" />
        </span>
        <p className="mt-2 text-[12.5px] font-bold text-foreground">¿Necesitas ayuda?</p>
        <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">
          Si no escuchas o no te ven, revisa micrófono y cámara en la barra de controles.
        </p>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent(EVENTO_COMANDO_SALA, { detail: { tipo: "abrirConfiguracion" } }))}
          className="mt-2 inline-flex items-center gap-1 text-[12px] font-bold text-primary hover:underline"
        >
          Abrir configuración <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}
