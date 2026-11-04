"use client";

/* eslint-disable @next/next/no-img-element -- los QR son data-URLs generados
   en el servidor; next/image no aporta nada sobre un data-URL y complica la
   impresión. */

import { useState } from "react";
import { QrCode, Copy, Check, Printer, ExternalLink, Maximize2, Download, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export type EnlaceQr = {
  titulo: string;
  descripcion: string;
  url: string;
  qrDataUrl: string;
};

/** Contexto que sale en la ficha ampliada (cartel) para que se sepa de qué jornada es el QR. */
export type ContextoQr = { titulo: string; detalle?: string };

function nombreArchivo(contexto: ContextoQr | undefined, e: EnlaceQr) {
  const base = [contexto?.titulo, e.titulo].filter(Boolean).join(" - ");
  return `QR ${base}`.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-") + ".png";
}

function useCopiar() {
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
  return { copiado, copiar };
}

/**
 * ACCESOS DE LA JORNADA: cada enlace estable (sala, presaber, postsaber,
 * invitados) como una fila compacta -QR, para qué sirve, enlace, copiar y
 * abrir-, pensada para la columna lateral junto a las jornadas. Al imprimir
 * los QR salen grandes, uno por bloque, para el cartel del salón.
 *
 * Cada QR se abre en una FICHA AMPLIADA (modal) con el código a tamaño de
 * cartel, el enlace completo y acciones para compartirlo: copiar, descargar
 * el PNG, compartir por el sistema (WhatsApp, correo...) e imprimir solo
 * esa ficha.
 *
 * Los QR apuntan a enlaces ESTABLES (/c/...): se resuelven al destino
 * vigente en el momento del escaneo, así que el mismo cartel sirve toda la
 * vigencia aunque cambie la sala o se rehaga la evaluación.
 */
export function ActivityQrPanel({ enlaces, contexto }: { enlaces: EnlaceQr[]; contexto?: ContextoQr }) {
  const { copiado, copiar } = useCopiar();
  const [ampliado, setAmpliado] = useState<EnlaceQr | null>(null);

  return (
    <section className="barra-modulo space-y-4 p-5 print:border-0 print:shadow-none" aria-label="Accesos de la jornada" data-qr-panel>
      <div className="flex items-start justify-between gap-3 print:hidden">
        <div>
          <h2 className="flex items-center gap-2 font-display text-[0.98rem] font-bold text-foreground">
            <QrCode className="h-4 w-4 text-primary" aria-hidden="true" />
            Accesos de la jornada
          </h2>
          <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
            Enlaces estables: el mismo QR sirve toda la vigencia. Toca un QR para ampliarlo y compartirlo.
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
            <button
              type="button"
              onClick={() => setAmpliado(e)}
              className="relative shrink-0 rounded-md border border-border bg-white p-0.5 outline-none ring-primary/40 transition-shadow hover:shadow-md focus-visible:ring-2 print:pointer-events-none print:border-0 print:shadow-none"
              aria-label={`Ampliar código QR: ${e.titulo}`}
              title="Ampliar y compartir"
            >
              <img src={e.qrDataUrl} alt={`Código QR: ${e.titulo}`} className="h-[96px] w-[96px] rounded-[4px] print:h-56 print:w-56" />
              <span className="absolute -right-1.5 -bottom-1.5 grid h-6 w-6 place-items-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors group-hover:bg-primary group-hover:text-primary-foreground print:hidden" aria-hidden="true">
                <Maximize2 className="h-3 w-3" />
              </span>
            </button>
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
              <Button type="button" variant="outline" size="sm" onClick={() => setAmpliado(e)} className="mt-2 gap-1.5 print:hidden">
                <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
                Ampliar y compartir
              </Button>
              <p className="hidden break-all font-mono text-xs print:block">{e.url}</p>
            </div>
          </li>
        ))}
      </ul>

      <FichaQr enlace={ampliado} contexto={contexto} onClose={() => setAmpliado(null)} />
    </section>
  );
}

/**
 * FICHA AMPLIADA: el QR a tamaño de cartel con el enlace completo y las
 * acciones para compartirlo. Al imprimir con la ficha abierta sale SOLO la
 * ficha (ver `print:` en el contenido y `data-ficha-qr` en globals).
 */
function FichaQr({ enlace, contexto, onClose }: { enlace: EnlaceQr | null; contexto?: ContextoQr; onClose: () => void }) {
  const { copiado, copiar } = useCopiar();
  const [compartido, setCompartido] = useState(false);
  const puedeCompartir = typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function compartir(e: EnlaceQr) {
    const titulo = [contexto?.titulo, e.titulo].filter(Boolean).join(" · ");
    const texto = `${titulo}\n${e.descripcion}\n${e.url}`;
    try {
      // Si el sistema acepta archivos, va el PNG del QR junto al enlace.
      const res = await fetch(e.qrDataUrl);
      const blob = await res.blob();
      const archivo = new File([blob], nombreArchivo(contexto, e), { type: "image/png" });
      const conArchivo = { title: titulo, text: texto, url: e.url, files: [archivo] };
      if (navigator.canShare?.({ files: [archivo] })) await navigator.share(conArchivo);
      else await navigator.share({ title: titulo, text: texto, url: e.url });
      setCompartido(true);
      setTimeout(() => setCompartido(false), 2000);
    } catch {
      // Cancelado por la persona o sin soporte: queda copiar/descargar.
    }
  }

  return (
    <Dialog open={enlace !== null} onOpenChange={(abierto) => { if (!abierto) onClose(); }}>
      <DialogContent
        className="w-[min(100vw-2rem,560px)] gap-0 p-0 sm:max-w-[560px] print:fixed print:inset-0 print:max-w-none print:translate-x-0 print:translate-y-0 print:rounded-none print:ring-0"
        showCloseButton
        data-ficha-qr
      >
        {enlace && (
          <div className="flex flex-col items-center px-6 pt-8 pb-6 text-center">
            {contexto && (
              <p className="mono-label text-primary">{contexto.titulo}{contexto.detalle ? ` · ${contexto.detalle}` : ""}</p>
            )}
            <DialogTitle className="mt-2 font-display text-2xl font-bold text-foreground print:text-4xl">{enlace.titulo}</DialogTitle>
            <DialogDescription className="mt-1.5 max-w-[42ch] text-[13px] leading-snug text-muted-foreground print:text-lg">{enlace.descripcion}</DialogDescription>

            <div className="mt-5 rounded-2xl border border-border bg-white p-3 shadow-sm print:border-0 print:shadow-none">
              <img
                src={enlace.qrDataUrl}
                alt={`Código QR ampliado: ${enlace.titulo}`}
                className="h-[min(70vw,320px)] w-[min(70vw,320px)] print:h-[60vmin] print:w-[60vmin]"
              />
            </div>
            <p className="mt-3 text-[12px] text-muted-foreground print:text-base">Escanea con la cámara del celular</p>

            <div className="mt-4 flex w-full items-center gap-1 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 print:hidden">
              <code className="min-w-0 flex-1 truncate text-left font-mono text-[11px] text-foreground">{enlace.url.replace(/^https?:\/\//, "")}</code>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => copiar(enlace.url)} aria-label="Copiar enlace" title="Copiar enlace">
                {copiado === enlace.url ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
              <a href={enlace.url} target="_blank" rel="noreferrer" className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Abrir enlace" title="Abrir">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
            <p className="hidden break-all font-mono text-sm print:block">{enlace.url}</p>

            <div className="mt-4 flex w-full flex-wrap justify-center gap-2 print:hidden">
              <Button type="button" size="sm" onClick={() => copiar(enlace.url)} className="gap-1.5">
                {copiado === enlace.url ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copiado === enlace.url ? "Enlace copiado" : "Copiar enlace"}
              </Button>
              <Button type="button" variant="outline" size="sm" className="gap-1.5" render={<a href={enlace.qrDataUrl} download={nombreArchivo(contexto, enlace)} />}>
                <Download className="h-3.5 w-3.5" />
                Descargar QR
              </Button>
              {puedeCompartir && (
                <Button type="button" variant="outline" size="sm" onClick={() => compartir(enlace)} className="gap-1.5">
                  {compartido ? <Check className="h-3.5 w-3.5 text-success" /> : <Share2 className="h-3.5 w-3.5" />}
                  Compartir
                </Button>
              )}
              <Button type="button" variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5">
                <Printer className="h-3.5 w-3.5" />
                Imprimir ficha
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
