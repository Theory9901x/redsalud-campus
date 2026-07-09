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
          // (RSC): no hay una promesa que avise cuándo el contenido nuevo ya
          // está montado. Un par de frames fijos NO alcanza -en rutas con
          // compilación en frío (dev) o una conexión lenta, la navegación
          // real puede tardar segundos-, y resolver antes de tiempo hace que
          // el navegador capture el "después" con el DOM todavía a medio
          // actualizar: la transición revienta con
          // "Transition was aborted because of timeout in DOM update" y dejó
          // estilos de la transición aplicados sobre contenido que nunca
          // terminó de asentarse (el bug real detrás del título gigante que
          // se vio en Momento 3). En vez de adivinar un tiempo fijo, se
          // observan mutaciones reales del DOM y se resuelve cuando se
          // asientan (300ms sin cambios nuevos), con un techo de seguridad
          // para no acercarse nunca al timeout propio del navegador.
          // Interceptar el click a mano también salta el reset de scroll que
          // <Link> dispara normalmente en una navegación nueva: sin esto, la
          // página nueva hereda el scroll de la vieja (p. ej. si el usuario
          // se desplazó para ver la tarjeta que clickeó), dejando su propio
          // encabezado fuera de vista por arriba.
          let settleTimer: ReturnType<typeof setTimeout>;
          const finish = () => {
            observer.disconnect();
            clearTimeout(settleTimer);
            clearTimeout(ceilingTimer);
            window.scrollTo(0, 0);
            resolve();
          };
          const observer = new MutationObserver(() => {
            clearTimeout(settleTimer);
            settleTimer = setTimeout(finish, 300);
          });
          observer.observe(document.body, { childList: true, subtree: true, attributes: true });
          settleTimer = setTimeout(finish, 300);
          const ceilingTimer = setTimeout(finish, 3000);
        });
      });
    }

    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, [router]);

  return null;
}
