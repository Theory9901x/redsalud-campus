"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

/**
 * Carcasa del panel lateral de detalle.
 *
 * Está abierto cuando la URL trae `?persona=<id>`, y cerrarlo simplemente
 * quita ese parámetro. Hacerlo por URL y no con estado local tiene tres
 * consecuencias que se agradecen: el contenido lo arma el servidor (no hace
 * falta un endpoint nuevo ni pasar los datos por el cliente), el enlace a una
 * persona concreta se puede compartir, y el botón "atrás" cierra el panel en
 * vez de sacarte de la página.
 */
export function PanelPersona({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const abierto = Boolean(searchParams.get("persona"));

  function cerrar() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("persona");
    const query = params.toString();
    router.push(query ? `/admin?${query}` : "/admin", { scroll: false });
  }

  return (
    <Sheet open={abierto} onOpenChange={(v) => !v && cerrar()}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-md">
        {children}
      </SheetContent>
    </Sheet>
  );
}

export { SheetHeader as PanelHeader, SheetTitle as PanelTitle, SheetDescription as PanelDescription };
