"use client";

import { useSyncExternalStore } from "react";

/** Sin suscripción: estos valores no cambian durante la vida de la página. */
const sinCambios = () => () => {};

/**
 * `true` solo después de hidratar; `false` en el servidor y en el primer
 * render del cliente.
 *
 * Sustituye al clásico `useEffect(() => setMontado(true), [])`, que pinta dos
 * veces siempre. `useSyncExternalStore` distingue el render del servidor del
 * del cliente sin efecto ni segundo render: para eso está su tercer argumento.
 *
 * Sirve para lo que el servidor no puede saber -el tema elegido, el ancho de
 * la ventana- y que pintado a ciegas provocaría un salto al hidratar.
 */
export function useEstaMontado(): boolean {
  return useSyncExternalStore(
    sinCambios,
    () => true,
    () => false
  );
}

/**
 * Si la persona pidió menos movimiento en su sistema operativo.
 *
 * En el servidor devuelve `false` -no hay forma de saberlo- y se corrige al
 * hidratar. Leer `window.matchMedia` dentro de un efecto y guardarlo en estado
 * hacía lo mismo, pero con un render de más.
 */
export function usePrefiereMenosMovimiento(): boolean {
  return useSyncExternalStore(
    (alCambiar) => {
      const consulta = window.matchMedia("(prefers-reduced-motion: reduce)");
      consulta.addEventListener("change", alCambiar);
      return () => consulta.removeEventListener("change", alCambiar);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false
  );
}

/**
 * El fragmento actual de la URL (`#...`).
 *
 * `usePathname()` de Next no lo incluye, y sin él dos enlaces a la misma ruta
 * -"Mis cursos" y "Mis certificados", ambos en /mi-aula- se marcarían activos
 * a la vez. El hash es estado del navegador, no de React: se lee con
 * `useSyncExternalStore` en vez de copiarlo a estado desde un efecto, que
 * obligaba a pintar dos veces en cada navegación.
 *
 * `pathname` entra como argumento solo para volver a leerlo al cambiar de
 * ruta: navegar no dispara el evento `hashchange`.
 */
export function useHashActual(pathname: string): string {
  return useSyncExternalStore(
    (alCambiar) => {
      window.addEventListener("hashchange", alCambiar);
      return () => window.removeEventListener("hashchange", alCambiar);
    },
    () => (void pathname, window.location.hash),
    () => ""
  );
}
