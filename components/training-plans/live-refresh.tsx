"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Refresca la ruta cada `segundos` para que un panel EN VIVO (quién está
 * presentando ahora mismo) no se quede parado en foto fija. router.refresh()
 * vuelve a pedir los Server Components de la ruta actual sin perder el
 * estado del cliente (scroll, filtros abiertos) ni recargar la página.
 */
export function LiveRefresh({ segundos = 20 }: { segundos?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), segundos * 1000);
    return () => clearInterval(id);
  }, [router, segundos]);
  return null;
}
