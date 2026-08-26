"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, ExternalLink, QrCode, X } from "lucide-react";

/**
 * Difusión de una encuesta: el enlace público y su QR.
 *
 * El QR se pide al servidor al abrir el diálogo, no se genera en cada
 * tarjeta al pintar el listado: con veinte encuestas serían veinte imágenes
 * de 300×300 en el HTML que casi nadie va a mirar.
 */
export function BotonEnlacePublico({
  slug,
  titulo,
  acento,
}: {
  slug: string;
  titulo: string;
  acento: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const url = typeof window !== "undefined" ? `${window.location.origin}/e/${slug}` : `/e/${slug}`;

  async function abrir() {
    setAbierto(true);
    if (!qr) {
      const r = await fetch(`/api/encuestas/${slug}/qr`);
      if (r.ok) setQr((await r.json()).qr);
    }
  }

  async function copiar() {
    await navigator.clipboard.writeText(url);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        title="Enlace público y QR"
        aria-label="Enlace público y QR"
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
      >
        <QrCode className="h-4 w-4" aria-hidden="true" />
      </button>

      {/* Portal al body: dentro de la tarjeta glass, el backdrop-filter del
          ancestro convierte al fixed en relativo y el diálogo sale recortado. */}
      {abierto &&
        createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`Difusión de ${titulo}`}
          onClick={() => setAbierto(false)}
        >
          <div className="surface-vivo w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: acento }}>
                    Difusión
                  </p>
                  <h2 className="mt-1 font-display text-lg font-extrabold tracking-tight text-foreground">
                    Enlace público
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setAbierto(false)}
                  aria-label="Cerrar"
                  className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>

              <div className="mt-5 flex justify-center rounded-2xl border border-border/60 bg-white p-4 shadow-sm">
                {qr ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qr} alt={`Código QR de ${titulo}`} className="h-56 w-56" />
                ) : (
                  <div className="h-56 w-56 animate-pulse rounded-xl bg-muted" />
                )}
              </div>

              <p className="mt-3 text-center text-[12px] leading-relaxed text-muted-foreground">
                Cualquiera con este enlace puede responder, sin necesidad de cuenta.
              </p>

              <div className="mt-4 rounded-xl border border-border/60 bg-muted/40 p-3">
                <code className="block break-all font-mono text-[12px] leading-relaxed text-foreground">{url}</code>
                <button
                  type="button"
                  onClick={copiar}
                  className="mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] font-bold text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: acento }}
                >
                  {copiado ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiado ? "Enlace copiado" : "Copiar enlace"}
                </button>
              </div>

              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="mt-3 flex items-center justify-center gap-1.5 text-[13px] font-semibold hover:underline"
                style={{ color: acento }}
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                Abrir encuesta
              </a>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
