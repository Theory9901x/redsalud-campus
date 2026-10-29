"use client";

import { useState } from "react";
import Link from "next/link";
import {
  PhoneCall,
  Users,
  Activity,
  StickyNote,
  MessageCircle,
  CircleDot,
  Files,
  Settings,
  Info,
  ClipboardList,
  LifeBuoy,
} from "lucide-react";
import { EVENTO_COMANDO_SALA, type ComandoSala } from "@/components/training-plans/sala-virtual";

type Item =
  | { clave: string; etiqueta: string; icono: React.ComponentType<{ className?: string }>; ancla: string }
  | { clave: string; etiqueta: string; icono: React.ComponentType<{ className?: string }>; comando: ComandoSala }
  | { clave: string; etiqueta: string; icono: React.ComponentType<{ className?: string }>; href: string };

/**
 * RIEL de la sala: una columna estrecha de iconos con etiqueta técnica.
 * Navega dentro de la misma página (anclas) o manda comandos a la consola
 * (chat, personas, bitácora…). Nunca recarga: la llamada no se interrumpe.
 */
export function NavSala({ archivosHref, conGrabacion, conGestion = false }: { archivosHref: string; conGrabacion: boolean; conGestion?: boolean }) {
  const [activo, setActivo] = useState("llamada");

  const items: Item[] = [
    { clave: "llamada", etiqueta: "Sala", icono: PhoneCall, ancla: "llamada" },
    { clave: "info", etiqueta: "Info", icono: Info, comando: "abrirInfo" },
    ...(conGestion ? [{ clave: "gestion", etiqueta: "Acta", icono: ClipboardList, ancla: "contenido-reunion" } as Item] : []),
    { clave: "participantes", etiqueta: "Personas", icono: Users, comando: "abrirParticipantes" },
    { clave: "chat", etiqueta: "Chat", icono: MessageCircle, comando: "enfocarChat" },
    { clave: "bitacora", etiqueta: "Bitácora", icono: Activity, comando: "abrirBitacora" },
    { clave: "notas", etiqueta: "Notas", icono: StickyNote, comando: "abrirNotas" },
    ...(conGrabacion ? [{ clave: "grabaciones", etiqueta: "Grabar", icono: CircleDot, ancla: "grabacion" } as Item] : []),
    { clave: "archivos", etiqueta: "Archivos", icono: Files, href: archivosHref },
    { clave: "configuracion", etiqueta: "Ajustes", icono: Settings, comando: "abrirConfiguracion" },
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
    <aside className="sh-panel sh-rise flex h-full flex-col items-stretch px-2.5 py-3 lg:sticky lg:top-4" style={{ "--i": 1 } as React.CSSProperties}>
      <nav aria-label="Secciones de la sala" className="flex flex-col gap-0.5">
        {items.map((item) => {
          if ("href" in item) {
            return (
              <Link key={item.clave} href={item.href} target="_blank" className="sh-rail-btn" title={item.etiqueta}>
                <item.icono className="h-[18px] w-[18px]" />
                {item.etiqueta}
              </Link>
            );
          }
          return (
            <button key={item.clave} type="button" onClick={() => activar(item)} className="sh-rail-btn" aria-current={activo === item.clave} title={item.etiqueta}>
              <item.icono className="h-[18px] w-[18px]" />
              {item.etiqueta}
            </button>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={() => window.dispatchEvent(new CustomEvent(EVENTO_COMANDO_SALA, { detail: { tipo: "abrirConfiguracion" } }))}
        className="sh-rail-btn mt-auto border-t border-[var(--sh-line)] pt-4"
        title="¿No te escuchan? Revisa micrófono y cámara"
      >
        <LifeBuoy className="h-[18px] w-[18px]" />
        Ayuda
      </button>
    </aside>
  );
}
