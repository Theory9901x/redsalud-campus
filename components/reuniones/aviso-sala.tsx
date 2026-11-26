import { Info } from "lucide-react";

/**
 * AVISO FIJO DENTRO DE LA SALA.
 *
 * Una nota que todos los asistentes ven mientras están en la llamada, con un
 * enlace. Se define por reunión (id del plan): hoy solo la socialización del
 * campus lo usa. Para otra reunión, se agrega aquí su entrada.
 */
type Aviso = { enlace: string; textoEnlace: string; notas: string[] };

const AVISOS: Record<string, Aviso> = {
  // Socialización del campus virtual.
  cmwv5tj0v00m2msl8m8588jrz: {
    enlace: "https://campusvirtual.redsaludteforma.com",
    textoEnlace: "campusvirtual.redsaludteforma.com",
    notas: [
      "Si eres contratista, debes registrarte.",
      "Si eres de planta, ya estás registrado: pide tus credenciales a Talento Humano.",
    ],
  },
};

export function AvisoSala({ planId, className = "" }: { planId: string; className?: string }) {
  const aviso = AVISOS[planId];
  if (!aviso) return null;
  return (
    <aside
      aria-label="Aviso de la sesión"
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-primary/35 bg-primary/10 px-4 py-2.5 text-sm leading-snug ${className}`}
    >
      <Info className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <span>
        Ingresa al campus:{" "}
        <a href={aviso.enlace} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline underline-offset-2">
          {aviso.textoEnlace}
        </a>
      </span>
      {aviso.notas.map((n) => (
        <span key={n} className="opacity-90">{n}</span>
      ))}
    </aside>
  );
}
