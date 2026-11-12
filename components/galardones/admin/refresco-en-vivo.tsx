"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

const CADA = 10000;
/** Tras la última tecla, cuánto se espera antes de volver a refrescar solo. */
const PAUSA_AL_ESCRIBIR = 6000;
const HORA = new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit", second: "2-digit", timeZone: "America/Bogota" });

const hayDialogo = () => !!document.querySelector('[role="dialog"], [role="alertdialog"]');

/**
 * La gestión de Galardones se lee en el servidor al abrir la página; sin esto,
 * las postulaciones que llegan mientras Talento Humano la tiene abierta no se
 * veían hasta recargar. Vuelve a pedir la página cada 10 s (y al volver a la
 * pestaña) sin perder filtros ni página, y trae el botón «Actualizar» para
 * pedirla en el acto.
 *
 * Solo se salta el refresco automático con un diálogo de confirmación abierto
 * o mientras se está tecleando. Antes bastaba con que el cursor estuviera en
 * un campo -p. ej. el buscador, donde se queda después de buscar- y la
 * pantalla dejaba de actualizarse sin avisar.
 */
export function RefrescoEnVivo() {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [actualizado, setActualizado] = useState<Date | null>(null);
  const ultimaTecla = useRef(0);

  const refrescar = useCallback(() => {
    iniciar(() => router.refresh());
    setActualizado(new Date());
  }, [router]);

  useEffect(() => {
    const auto = () => {
      if (document.visibilityState !== "visible" || hayDialogo()) return;
      if (Date.now() - ultimaTecla.current < PAUSA_AL_ESCRIBIR) return;
      refrescar();
    };
    const alVolver = () => {
      if (document.visibilityState === "visible") auto();
    };
    const alTeclear = () => {
      ultimaTecla.current = Date.now();
    };
    const t = setInterval(auto, CADA);
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("focus", alVolver);
    document.addEventListener("keydown", alTeclear, true);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener("focus", alVolver);
      document.removeEventListener("keydown", alTeclear, true);
    };
  }, [refrescar]);

  return (
    <span className="inline-flex flex-wrap items-center gap-2.5">
      <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground" aria-live="off">
        <span className="relative flex h-2 w-2" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
        </span>
        En vivo{actualizado ? ` · actualizado ${HORA.format(actualizado)}` : ""}
      </span>
      <button type="button" onClick={refrescar} disabled={pendiente} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}>
        <RefreshCw className={cn("h-3.5 w-3.5", pendiente && "animate-spin")} aria-hidden="true" />
        Actualizar
      </button>
    </span>
  );
}
