"use client";

import { useState } from "react";
import { ChevronDown, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { FilaAcceso, type AccesoConQr } from "@/components/training-plans/accesos-jornada";



/**
 * ENLACES GENERALES de la capacitación (/c/<actividad>/..., /invitado/
 * <actividad>). Ya no son la forma principal de compartir: cada jornada
 * tiene los suyos. Se conservan porque hay QR impresos con ellos; al
 * escanearlos se resuelven a la jornada vigente (en curso, o la próxima).
 */
export function EnlacesGenerales({ enlaces, jornadaVigente }: { enlaces: AccesoConQr[]; jornadaVigente: string | null }) {
  const [abierto, setAbierto] = useState(false);

  return (
    <section className="rounded-[14px] border border-dashed border-border/80 bg-card/60" aria-label="Enlaces generales de la capacitación">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="min-w-0">
          <span className="flex items-center gap-2 text-[13px] font-bold text-foreground">
            <Link2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            Enlaces generales de la capacitación
          </span>
          <span className="mt-0.5 block text-[11.5px] leading-snug text-muted-foreground">
            Para QR que ya estén impresos: siguen funcionando y llevan a la jornada vigente
            {jornadaVigente ? ` (hoy: ${jornadaVigente})` : " (en curso, o la próxima agendada)"}. Para compartir, usa los
            accesos de cada jornada.
          </span>
        </span>
        <ChevronDown className={cn("mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform", abierto && "rotate-180")} aria-hidden="true" />
      </button>
      {abierto && (
        <ul className="grid grid-cols-1 gap-2.5 border-t border-border/60 p-4 2xl:grid-cols-2">
          {enlaces.map((e) => (
            <FilaAcceso key={e.url} acceso={e} />
          ))}
        </ul>
      )}
    </section>
  );
}
