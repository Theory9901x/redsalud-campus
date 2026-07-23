"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";

const OPCIONES = [
  { valor: "light", etiqueta: "Tema claro", Icono: Sun },
  { valor: "dark", etiqueta: "Tema oscuro", Icono: Moon },
  { valor: "system", etiqueta: "Según el sistema", Icono: Monitor },
] as const;

/**
 * Selector de tema: tres estados visibles a la vez, no un botón que va
 * rotando. Con un botón cíclico la persona tiene que adivinar cuántos clics
 * faltan para volver a donde estaba; aquí cada estado está a un clic y el
 * actual se ve marcado.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [montado, setMontado] = useState(false);

  // En el servidor no se sabe qué tema tiene la persona (vive en su navegador),
  // así que hasta que el componente monta se pinta el marco sin ninguna opción
  // marcada. Marcar una al azar produciría un salto visible al hidratar.
  useEffect(() => setMontado(true), []);

  return (
    <div
      role="radiogroup"
      aria-label="Tema de la interfaz"
      className={`inline-flex items-center gap-0.5 rounded-full border border-border bg-muted/60 p-0.5 ${className}`}
    >
      {OPCIONES.map(({ valor, etiqueta, Icono }) => {
        const activo = montado && theme === valor;
        return (
          <button
            key={valor}
            type="button"
            role="radio"
            aria-checked={activo}
            aria-label={etiqueta}
            title={etiqueta}
            onClick={() => setTheme(valor)}
            className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
              activo
                ? "bg-card text-foreground shadow-[var(--shadow-0)]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icono className="h-3.5 w-3.5" />
          </button>
        );
      })}
    </div>
  );
}
