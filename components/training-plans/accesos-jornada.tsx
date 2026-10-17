"use client";

/* eslint-disable @next/next/no-img-element -- los QR son data-URLs generados
   en el servidor; next/image no aporta nada sobre un data-URL. */

import { useState } from "react";
import { Check, ChevronDown, Copy, ExternalLink, Printer, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AccesoConQr = {
  clave: string;
  titulo: string;
  descripcion: string;
  url: string;
  qrDataUrl: string;
};

/** Una fila de acceso: QR, para qué sirve, enlace, copiar y abrir. */
export function FilaAcceso({ acceso, destacado = false }: { acceso: AccesoConQr; destacado?: boolean }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(acceso.url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sin permiso de portapapeles: el enlace queda visible para copiarlo a mano.
    }
  }

  return (
    <li
      className={cn(
        "flex items-center gap-3.5 rounded-[14px] border bg-card p-3 transition-colors hover:border-primary/40",
        destacado ? "border-primary/35" : "border-border/80"
      )}
    >
      <img
        src={acceso.qrDataUrl}
        alt={`Código QR: ${acceso.titulo}`}
        className="h-[72px] w-[72px] shrink-0 rounded-md border border-border bg-white p-0.5"
      />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold text-foreground">{acceso.titulo}</p>
        <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-muted-foreground">{acceso.descripcion}</p>
        <div className="mt-1.5 flex items-center gap-1">
          <code className="min-w-0 flex-1 truncate font-mono text-[10.5px] text-muted-foreground">
            {acceso.url.replace(/^https?:\/\//, "")}
          </code>
          <Button type="button" variant="ghost" size="icon-sm" onClick={copiar} aria-label={`Copiar enlace: ${acceso.titulo}`} title="Copiar enlace">
            {copiado ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
          <a
            href={acceso.url}
            target="_blank"
            rel="noreferrer"
            className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={`Abrir: ${acceso.titulo}`}
            title="Abrir"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </li>
  );
}

/**
 * ACCESOS DE ESTA JORNADA: su propio QR y enlace para la puerta, la sala, el
 * presaber, el postsaber y los invitados. Plegado por defecto para que la
 * lista de jornadas se lea de un vistazo.
 */
export function AccesosJornada({
  accesos,
  fichaHref,
  abiertoInicial = false,
}: {
  accesos: AccesoConQr[];
  /** Cartel proyectable/imprimible de la jornada (QR grande de la puerta). */
  fichaHref?: string;
  abiertoInicial?: boolean;
}) {
  const [abierto, setAbierto] = useState(abiertoInicial);

  return (
    <div className="rounded-[14px] border border-border/60 bg-muted/25">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-[13px] font-bold text-foreground">
          <QrCode className="h-4 w-4 text-primary" aria-hidden="true" />
          Accesos de esta jornada
          <span className="font-normal text-muted-foreground">· {accesos.length} enlaces con QR</span>
        </span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", abierto && "rotate-180")} aria-hidden="true" />
      </button>
      {abierto && (
        <div className="space-y-3 border-t border-border/60 p-4" role="region" aria-label="Accesos de esta jornada">
          <p className="text-[12px] leading-snug text-muted-foreground">
            Estos enlaces son solo de esta jornada: la asistencia, las evaluaciones, los invitados y las conexiones a la sala
            que entren por ellos quedan registrados en ella.
          </p>
          <ul className="grid grid-cols-1 gap-2.5 2xl:grid-cols-2">
            {accesos.map((a) => (
              <FilaAcceso key={a.clave} acceso={a} destacado={a.clave === "puerta"} />
            ))}
          </ul>
          {fichaHref && (
            <a
              href={fichaHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-[12px] font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary"
            >
              <Printer className="h-3.5 w-3.5" aria-hidden="true" />
              Cartel de la jornada para proyectar o imprimir
            </a>
          )}
        </div>
      )}
    </div>
  );
}
