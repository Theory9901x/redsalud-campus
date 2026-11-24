"use client";

import "./globals.css";
import { PantallaError } from "@/components/brand/pantalla-error";

/**
 * Error que rompe hasta el layout raíz. Reemplaza al layout, así que trae su
 * propio <html> y <body> y vuelve a cargar los estilos. Es aquí donde cae la
 * acción de servidor que ya no existe tras un despliegue (el caso del login).
 */
export default function ErrorGlobal({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="es">
      <body>
        <title>RedSalud Te Forma — Campus Virtual</title>
        <PantallaError error={error} reintentar={unstable_retry} />
      </body>
    </html>
  );
}
