"use client";

/* eslint-disable @next/next/no-img-element -- los QR son data-URLs generados
   en el servidor; next/image no aporta nada sobre un data-URL y complica la
   impresión. */

import { useState } from "react";
import { QrCode, Copy, Check, Printer, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export type EnlaceQr = {
  titulo: string;
  descripcion: string;
  url: string;
  qrDataUrl: string;
};

/**
 * ACCESOS DE LA JORNADA: cada enlace estable (sala, presaber, postsaber,
 * invitados) como una fila compacta -QR, para qué sirve, enlace, copiar y
 * abrir-, pensada para la columna lateral junto a las jornadas. Al imprimir
 * los QR salen grandes, uno por bloque, para el cartel del salón.
 *
 * Los QR apuntan a enlaces ESTABLES (/c/...): se resuelven al destino
 * vigente en el momento del escaneo, así que el mismo cartel sirve toda la
 * vigencia aunque cambie la sala o se rehaga la evaluación.
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
    <section className="barra-modulo space-y-4 p-5 print:border-0 print:shadow-none" aria-label="Accesos de la jornada" data-qr-panel>
      <div className="flex items-start justify-between gap-3 print:hidden">
        <div>
          <h2 className="flex items-center gap-2 font-display text-[0.98rem] font-bold text-foreground">
            <QrCode className="h-4 w-4 text-primary" aria-hidden="true" />
            Accesos de la jornada
          </h2>
          <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
            Enlaces estables: el mismo QR sirve toda la vigencia. Proyéctalos o imprímelos.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => window.print()} className="shrink-0 gap-1.5">
          <Printer className="h-3.5 w-3.5" aria-hidden="true" />
          Imprimir
        </Button>
      </div>

      <ul className="space-y-2.5 print:grid print:grid-cols-2 print:gap-6 print:space-y-0">
        {enlaces.map((e) => (
          <li
            key={e.url}
            className="group flex items-center gap-3.5 rounded-[14px] border border-border/80 bg-card p-3 transition-colors hover:border-primary/40 print:flex-col print:border print:p-6 print:text-center"
          >
            <img
              src={e.qrDataUrl}
              alt={`Código QR: ${e.titulo}`}
              className="h-[72px] w-[72px] shrink-0 rounded-md border border-border bg-white p-0.5 print:h-56 print:w-56"
            />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-foreground print:text-lg">{e.titulo}</p>
              <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-muted-foreground">{e.descripcion}</p>
              <div className="mt-1.5 flex items-center gap-1 print:hidden">
                <code className="min-w-0 flex-1 truncate font-mono text-[10.5px] text-muted-foreground">{e.url.replace(/^https?:\/\//, "")}</code>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => copiar(e.url)}
                  aria-label={`Copiar enlace: ${e.titulo}`}
                  title="Copiar enlace"
                >
                  {copiado === e.url ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
                <a
                  href={e.url}
                  target="_blank"
                  rel="noreferrer"
                  className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label={`Abrir: ${e.titulo}`}
                  title="Abrir"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
              <p className="hidden break-all font-mono text-xs print:block">{e.url}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
