"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, Download, ExternalLink, MessageCircle, Printer, QrCode, Share2, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * DIFUSIÓN de una encuesta: el enlace público y su QR.
 *
 * El QR se pide al servidor al abrir el diálogo, no se genera en cada
 * tarjeta al pintar el listado: con veinte encuestas serían veinte imágenes
 * de 300×300 en el HTML que casi nadie va a mirar.
 *
 * Además de copiar el enlace: descargar el QR como PNG, imprimir un cartel
 * listo para la cartelera y compartir por WhatsApp o el menú del sistema.
 */
export function BotonEnlacePublico({
  slug,
  titulo,
  acento,
  variante = "icono",
}: {
  slug: string;
  titulo: string;
  acento: string;
  /** `icono` en tarjetas y cabeceras; `boton` como llamada a la acción con texto. */
  variante?: "icono" | "boton";
}) {
  const [abierto, setAbierto] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const url = typeof window !== "undefined" ? `${window.location.origin}/e/${slug}` : `/e/${slug}`;
  const urlCorta = url.replace(/^https?:\/\//, "");

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

  function descargar() {
    if (!qr) return;
    const a = document.createElement("a");
    a.href = qr;
    a.download = `qr-${slug}.png`;
    a.click();
  }

  async function compartir() {
    if (navigator.share) {
      try {
        await navigator.share({ title: titulo, text: `Responda la encuesta: ${titulo}`, url });
      } catch {
        /* cancelado */
      }
    } else {
      await copiar();
    }
  }

  /** Cartel imprimible: título, QR grande y enlace legible, en una hoja. */
  function imprimir() {
    if (!qr) return;
    const w = window.open("", "_blank", "width=820,height=1000");
    if (!w) return;
    w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${titulo}</title>
<style>
  body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0d2a4c;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fff}
  .cartel{width:640px;padding:48px;text-align:center;border:3px solid ${acento};border-radius:32px}
  .kicker{font-size:13px;letter-spacing:.2em;text-transform:uppercase;font-weight:800;color:${acento}}
  h1{font-size:34px;line-height:1.15;margin:12px 0 6px}
  p{font-size:16px;color:#475569;margin:0}
  img{width:380px;height:380px;margin:28px auto 16px;display:block}
  .url{font-family:ui-monospace,Menlo,monospace;font-size:15px;font-weight:700;color:#0d2a4c;background:#f1f5f9;padding:10px 16px;border-radius:12px;display:inline-block;word-break:break-all}
  .pie{margin-top:22px;font-size:12px;color:#94a3b8}
  @media print{body{min-height:auto}.cartel{border-width:2px}}
</style></head><body><div class="cartel">
  <div class="kicker">Escanee para responder</div>
  <h1>${titulo}</h1>
  <p>Su opinión es la base de nuestra mejora continua. Le tomará menos de 3 minutos.</p>
  <img src="${qr}" alt="Código QR">
  <div class="url">${urlCorta}</div>
  <div class="pie">Red Salud Casanare E.S.E. · Encuesta confidencial</div>
</div><script>window.onload=function(){window.print()}</script></body></html>`);
    w.document.close();
  }

  return (
    <>
      {variante === "boton" ? (
        <button
          type="button"
          onClick={abrir}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-bold text-white shadow-lg transition-transform hover:-translate-y-px"
          style={{ backgroundColor: acento, boxShadow: `0 14px 30px -14px ${acento}` }}
        >
          <QrCode className="h-4 w-4" aria-hidden="true" />
          Enlace y QR
        </button>
      ) : (
        <button
          type="button"
          onClick={abrir}
          title="Enlace público y QR"
          aria-label="Enlace público y QR"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
        >
          <QrCode className="h-4 w-4" aria-hidden="true" />
        </button>
      )}

      {/* Portal al body: dentro de la tarjeta glass, el backdrop-filter del
          ancestro convierte al fixed en relativo y el diálogo sale recortado. */}
      {abierto &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d2a4c]/60 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label={`Difusión de ${titulo}`}
            onClick={() => setAbierto(false)}
          >
            <div
              className="difusion-dialogo w-full max-w-md overflow-hidden rounded-[28px] bg-card shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Cabecera de marca con el QR enmarcado */}
              <div
                className="relative px-6 pb-8 pt-6 text-white"
                style={{ backgroundImage: `linear-gradient(150deg, ${acento}, color-mix(in oklch, ${acento} 60%, #0d2a4c))` }}
              >
                <div
                  className="pointer-events-none absolute inset-0 opacity-20"
                  style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,.6) 1px, transparent 0)", backgroundSize: "18px 18px" }}
                />
                <div className="relative flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10.5px] font-extrabold uppercase tracking-[0.2em] text-white/80">Difusión</p>
                    <h2 className="mt-1 truncate font-display text-[17px] font-extrabold leading-tight">{titulo}</h2>
                    <p className="mt-1 text-[12px] text-white/80">Escanee o comparta el enlace. No requiere cuenta.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAbierto(false)}
                    aria-label="Cerrar"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25"
                  >
                    <X className="h-4.5 w-4.5" aria-hidden="true" />
                  </button>
                </div>

                <div className="relative mx-auto mt-6 w-fit">
                  <span className="absolute -inset-3 rounded-[28px] bg-white/15 blur-md" aria-hidden="true" />
                  <div className="relative rounded-3xl bg-white p-3 shadow-[0_24px_50px_-20px_rgba(0,0,0,0.45)]">
                    {qr ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={qr} alt={`Código QR de ${titulo}`} className="h-52 w-52 rounded-xl" />
                    ) : (
                      <div className="h-52 w-52 animate-pulse rounded-xl bg-muted" />
                    )}
                    <span
                      className="absolute -bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1 text-[10.5px] font-extrabold uppercase tracking-[0.16em] text-white shadow-md"
                      style={{ backgroundColor: "#0d2a4c" }}
                    >
                      Escanee para responder
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-4 p-5">
                {/* Enlace */}
                <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-muted/40 p-2 pl-4">
                  <code className="min-w-0 flex-1 truncate font-mono text-[12.5px] font-semibold text-foreground">{urlCorta}</code>
                  <button
                    type="button"
                    onClick={copiar}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-[12.5px] font-bold text-white transition-all",
                      copiado && "scale-[1.03]"
                    )}
                    style={{ backgroundColor: copiado ? "#1f9d5a" : acento }}
                  >
                    {copiado ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <Copy className="h-3.5 w-3.5" />}
                    {copiado ? "Copiado" : "Copiar"}
                  </button>
                </div>

                {/* Acciones */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    { Icono: Download, texto: "PNG", accion: descargar, deshabilitado: !qr },
                    { Icono: Printer, texto: "Cartel", accion: imprimir, deshabilitado: !qr },
                    {
                      Icono: MessageCircle,
                      texto: "WhatsApp",
                      href: `https://wa.me/?text=${encodeURIComponent(`Responda la encuesta «${titulo}»: ${url}`)}`,
                    },
                    { Icono: Share2, texto: "Compartir", accion: compartir },
                  ].map((a) =>
                    "href" in a ? (
                      <a
                        key={a.texto}
                        href={a.href}
                        target="_blank"
                        rel="noreferrer"
                        className="flex flex-col items-center gap-1.5 rounded-2xl border border-border/60 bg-card px-2 py-3 text-[12px] font-bold text-foreground transition-all hover:-translate-y-px hover:border-foreground/25 hover:shadow-md"
                      >
                        <a.Icono className="h-5 w-5" style={{ color: acento }} aria-hidden="true" />
                        {a.texto}
                      </a>
                    ) : (
                      <button
                        key={a.texto}
                        type="button"
                        onClick={a.accion}
                        disabled={a.deshabilitado}
                        className="flex flex-col items-center gap-1.5 rounded-2xl border border-border/60 bg-card px-2 py-3 text-[12px] font-bold text-foreground transition-all hover:-translate-y-px hover:border-foreground/25 hover:shadow-md disabled:opacity-50"
                      >
                        <a.Icono className="h-5 w-5" style={{ color: acento }} aria-hidden="true" />
                        {a.texto}
                      </button>
                    )
                  )}
                </div>

                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-1.5 text-[13px] font-semibold hover:underline"
                  style={{ color: acento }}
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  Abrir la encuesta como la ve el usuario
                </a>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
