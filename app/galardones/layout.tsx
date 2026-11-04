import type { Metadata } from "next";
import "./galardones.css";
import { EscenaGalardones } from "@/components/galardones/escena";
import { NOMBRE_EVENTO, NOMBRE_RECONOCIMIENTO } from "@/lib/galardones/valores";

export const metadata: Metadata = {
  title: `${NOMBRE_EVENTO} · ${NOMBRE_RECONOCIMIENTO}`,
  description: "Postulación de colaboradores al reconocimiento al mérito por los valores del Código de Integridad.",
};

/**
 * Entorno AISLADO a propósito, sin la barra lateral ni la cabecera del
 * campus: es la antesala de una ceremonia, no una pantalla más del sistema.
 * Siempre oscuro, con su propia escena (app/galardones/galardones.css).
 */
export default function GalardonesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="gala">
      <EscenaGalardones />
      {children}
    </div>
  );
}
