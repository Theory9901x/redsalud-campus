import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { NOMBRE_EVENTO } from "@/lib/galardones/valores";

/** Fondo animado del entorno de galardones: rejilla, auroras y barrido. */
export function EscenaGalardones() {
  return (
    <div className="gala-escena" aria-hidden="true">
      <div className="gala-rejilla" />
      <div className="gala-aurora gala-aurora-1" />
      <div className="gala-aurora gala-aurora-2" />
      <div className="gala-aurora gala-aurora-3" />
    </div>
  );
}

export function CabeceraGalardones({
  logoUrl,
  institucion,
  volverA,
  volverTexto,
  anio,
}: {
  logoUrl: string | null;
  institucion: string;
  volverA: string;
  volverTexto: string;
  anio: number;
}) {
  return (
    <header className="gala-cabecera">
      <div className="gala-marca">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" />
        ) : null}
        <div className="gala-marca-texto">
          <b>{institucion}</b>
          <small>
            {NOMBRE_EVENTO} {anio}
          </small>
        </div>
      </div>
      <Link href={volverA} className="gala-enlace">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        {volverTexto}
      </Link>
    </header>
  );
}
