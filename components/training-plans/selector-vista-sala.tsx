"use client";

import { useEffect, useState } from "react";
import { LayoutDashboard, Maximize2, PanelsTopLeft } from "lucide-react";
import { EVENTO_COMANDO_SALA, EVENTO_VISTA_SALA, elegirVistaSala, leerVistaSala, type VistaSala } from "@/components/training-plans/sala-virtual";

/**
 * Selector de las tres vistas de la sala: Enfoque, Completa y Ampliada.
 * Las dos primeras se recuerdan en el navegador; «Ampliada» es la pantalla
 * completa del navegador y se activa o desactiva como el botón Ampliar.
 */
export function SelectorVistaSala() {
  const [vista, setVista] = useState<VistaSala>("enfoque");
  const [ampliada, setAmpliada] = useState(false);
  useEffect(() => {
    const inicial = setTimeout(() => setVista(leerVistaSala()), 0);
    const alCambiar = (e: Event) => {
      const v = (e as CustomEvent<VistaSala>).detail;
      if (v === "enfoque" || v === "completa") setVista(v);
    };
    const alPantalla = () => setAmpliada(document.fullscreenElement !== null);
    window.addEventListener(EVENTO_VISTA_SALA, alCambiar);
    document.addEventListener("fullscreenchange", alPantalla);
    return () => {
      clearTimeout(inicial);
      window.removeEventListener(EVENTO_VISTA_SALA, alCambiar);
      document.removeEventListener("fullscreenchange", alPantalla);
    };
  }, []);

  const opciones = [
    { clave: "enfoque", etiqueta: "Enfoque", Icono: PanelsTopLeft, activa: !ampliada && vista === "enfoque", accion: () => elegirVistaSala("enfoque") },
    { clave: "completa", etiqueta: "Completa", Icono: LayoutDashboard, activa: !ampliada && vista === "completa", accion: () => elegirVistaSala("completa") },
    // El clic llega directo a requestFullscreen (mismo gesto del usuario).
    { clave: "ampliada", etiqueta: "Ampliada", Icono: Maximize2, activa: ampliada, accion: () => window.dispatchEvent(new CustomEvent(EVENTO_COMANDO_SALA, { detail: { tipo: "alternarAmpliado" } })) },
  ];

  return (
    <div role="group" aria-label="Vista de la sala" className="sh-seg hidden lg:inline-flex">
      {opciones.map((o) => (
        <button key={o.clave} type="button" onClick={o.accion} aria-pressed={o.activa} title={`Vista ${o.etiqueta.toLowerCase()}`}>
          <o.Icono className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden 2xl:inline">{o.etiqueta}</span>
        </button>
      ))}
    </div>
  );
}
