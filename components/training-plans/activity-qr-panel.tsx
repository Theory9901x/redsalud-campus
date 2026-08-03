"use client";

/* eslint-disable @next/next/no-img-element -- los QR son data-URLs generados
   en el servidor; next/image no aporta nada sobre un data-URL y complica la
   impresión. */

import { useState } from "react";
import { QrCode, Copy, Check, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export type EnlaceQr = {
  titulo: string;
  descripcion: string;
  url: string;
  qrDataUrl: string;
};

/**
 * Los tres accesos de la capacitación -Meet, presaber, postsaber- como
 * enlace y como código QR, listos para proyectar en el salón o imprimir en
 * el cartel de la jornada.
 *
 * Los QR apuntan a enlaces ESTABLES (/c/...): se resuelven al destino
 * vigente en el momento del escaneo, así que el mismo cartel sirve toda la
 * vigencia aunque cambie la sala de Meet o se rehaga la evaluación.
 */
export function ActivityQrPanel({ enlaces }: { enlaces: EnlaceQr[] }) {
  const [copiado, setCopiado] = useState<string | null>(null);

  async function copiar(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(url);
      setTimeout(() => setCopiado(null), 2000);
    } catch {
      // Sin permiso de portapapeles: el enlace queda visible para copiarlo a mano.
    }
  }

  return (
    <div className="surface-panel space-y-4 p-6 print:shadow-none" data-qr-panel>
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <h2 className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-foreground">
          <QrCode className="h-4 w-4 text-primary" aria-hidden="true" />
          Enlaces y códigos QR de la jornada
        </h2>
        <Button type="button" variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5">
          <Printer className="h-3.5 w-3.5" aria-hidden="true" />
          Imprimir
        </Button>
      </div>
      <p className="text-xs text-muted-foreground print:hidden">
        Proyéctalos o imprímelos: cada QR lleva al destino vigente en el momento del escaneo, así el mismo cartel
        sirve toda la vigencia. Presaber y postsaber piden iniciar sesión e inscriben a la persona automáticamente.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {enlaces.map((e) => (
          <div key={e.url} className="flex flex-col items-center gap-2 rounded-xl border border-border p-4 text-center">
            <p className="font-display text-sm font-bold text-foreground">{e.titulo}</p>
            <img src={e.qrDataUrl} alt={`Código QR: ${e.titulo}`} className="h-40 w-40" />
            <p className="text-[11px] leading-snug text-muted-foreground">{e.descripcion}</p>
            <div className="flex w-full items-center gap-1.5 print:hidden">
              <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1 text-left text-[11px] text-foreground">
                {e.url}
              </code>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => copiar(e.url)}
                aria-label={`Copiar enlace: ${e.titulo}`}
              >
                {copiado === e.url ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
