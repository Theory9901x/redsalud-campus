"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Crossfade nativo de página (View Transitions API del navegador, sin el
 * componente <ViewTransition> de React): ese componente solo existe en el
 * canal canary de React, que este proyecto no usa -actualizar react/react-dom
 * a canary para esto tiene un alcance mucho mayor que un cambio visual-. La
 * API del navegador (document.startViewTransition) es DOM puro y no depende
 * de qué versión de React esté instalada.
 *
 * Intercepta clicks sobre <a> internos una sola vez, a nivel de documento
 * (delegación de eventos), en vez de tocar cada Link de cada vista. Sin
 * soporte del navegador, o si el click no es un click "simple" en un enlace
 * interno, no hace nada y Next.js navega exactamente igual que siempre.
 *
 * En fase de CAPTURA, no de burbuja: el propio <Link> de Next ya hace su
 * propio preventDefault() + navegación en un listener de burbuja, así que un
 * listener de burbuja en document siempre llega tarde (ve e.defaultPrevented
 * ya en true y nunca alcanza a envolver la navegación). Capturando en
 * document, este handler corre ANTES de que el evento llegue al <Link>.
 */
export function NativeViewTransitions() {
  const router = useRouter();

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!("startViewTransition" in document)) return;
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const anchor = (e.target as HTMLElement | null)?.closest("a");
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;

      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (prefersReducedMotion) return;

      e.preventDefault();
      e.stopPropagation();
      const target = `${url.pathname}${url.search}${url.hash}`;

      document.startViewTransition(() => {
        return new Promise<void>((resolve) => {
          router.push(target);
          // router.push dispara el fetch/render de la ruta de forma asíncrona
          // (RSC): no hay una promesa que se resuelva justo cuando el nuevo
          // contenido ya está pintado, así que se espera un par de frames
          // como aproximación razonable. En el peor caso (conexión lenta) el
          // navegador simplemente interpola contra el contenido viejo un
          // instante más: se degrada a "sin animación visible", nunca a un
          // error o una navegación rota.
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        });
      });
    }

    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, [router]);

  return null;
}
