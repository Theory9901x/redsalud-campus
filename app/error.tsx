"use client";

import { PantallaError } from "@/components/brand/pantalla-error";

/** Error de cualquier página (dentro del layout raíz): ver PantallaError. */
export default function ErrorDePagina({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return <PantallaError error={error} reintentar={unstable_retry} />;
}
