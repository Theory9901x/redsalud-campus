import type { ReactNode } from "react";
import { Radio } from "lucide-react";
import type { CapacitacionEnVivo } from "@/lib/en-vivo";
import { ModuloHero } from "@/components/training-plans/modulo-hero";
import { PanelEnVivo } from "@/components/en-vivo/panel-en-vivo";

/**
 * Submódulo EN VIVO del plan de capacitaciones: el mismo contenido para el
 * personal (dentro de «Mis capacitaciones») y para la administración (como
 * pestaña del módulo de planes). Cada lado pone encima sus propias pestañas.
 */
export function VistaEnVivo({ fichas, pestanas }: { fichas: CapacitacionEnVivo[]; pestanas: ReactNode }) {
  const enVivo = fichas.filter((f) => f.estado === "EN_VIVO");
  return (
    <div className="space-y-6">
      {pestanas}
      <ModuloHero
        eyebrow="Plan de capacitaciones · En vivo"
        Icono={Radio}
        titulo="Capacitaciones"
        acento="en vivo"
        descripcion="Las capacitaciones en vivo que están ocurriendo ahora en la institución. No hace falta que te envíen el enlace ni el QR: busca la tuya y entra."
        cifras={[
          { valor: enVivo.length, etiqueta: "En vivo ahora" },
          { valor: enVivo.reduce((s, f) => s + f.conectados, 0), etiqueta: "Personas conectadas" },
          { valor: fichas.length - enVivo.length, etiqueta: "Próximas", detalle: "en 7 días" },
          { valor: new Set(enVivo.map((f) => f.area ?? "—")).size, etiqueta: "Áreas en vivo" },
        ]}
      />
      <PanelEnVivo fichas={fichas.map((f) => ({ ...f, inicio: f.inicio?.toISOString() ?? null, fin: f.fin?.toISOString() ?? null }))} />
    </div>
  );
}
