"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Proveedor del tema claro/oscuro.
 *
 * Se usa `next-themes` en vez de escribir el interruptor a mano por una razón
 * concreta: el parpadeo. Si la clase `dark` se pusiera desde un `useEffect`,
 * el navegador alcanzaría a pintar la página en claro antes de corregirla y
 * en modo oscuro se vería un fogonazo blanco en cada carga. `next-themes`
 * inyecta un script BLOQUEANTE en el `<head>` que lee la preferencia guardada
 * y estampa la clase en `<html>` antes del primer pintado.
 *
 * Ya era una dependencia del proyecto: `components/ui/sonner.tsx` llamaba a
 * `useTheme()` sin que existiera ningún proveedor, así que los avisos nunca
 * se adaptaron al tema. Con esto, además, empiezan a hacerlo.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      // Evita que las transiciones de color de toda la interfaz se disparen a
      // la vez al cambiar de tema: el cambio debe ser instantáneo, no un
      // barrido de medio segundo sobre cada superficie de la pantalla.
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
