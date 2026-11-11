"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const CADA = 10000;
const HORA = new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit", second: "2-digit", timeZone: "America/Bogota" });

/** No refrescar mientras alguien escribe o tiene abierto un diálogo de confirmación. */
function ocupado() {
  const el = document.activeElement;
  if (el instanceof HTMLElement && (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable)) return true;
  return !!document.querySelector('[role="dialog"], [role="alertdialog"]');
}

/**
 * La gestión de Galardones se lee en el servidor al abrir la página; sin esto,
 * las postulaciones que llegan mientras Talento Humano la tiene abierta no se
 * veían hasta recargar. Vuelve a pedir la página cada 10 s (y al volver a la
 * pestaña) sin perder filtros, página ni lo que se está escribiendo.
 */
export function RefrescoEnVivo() {
  const router = useRouter();
  const [, iniciar] = useTransition();
  const [actualizado, setActualizado] = useState<Date | null>(null);

  useEffect(() => {
    const refrescar = () => {
      if (document.visibilityState !== "visible" || ocupado()) return;
      iniciar(() => router.refresh());
      setActualizado(new Date());
    };
    const alVolver = () => {
      if (document.visibilityState === "visible") refrescar();
    };
    const t = setInterval(refrescar, CADA);
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("focus", alVolver);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener("focus", alVolver);
    };
  }, [router]);

  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground" aria-live="off">
      <span className="relative flex h-2 w-2" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
      </span>
      En vivo{actualizado ? ` · actualizado ${HORA.format(actualizado)}` : ""}
    </span>
  );
}
