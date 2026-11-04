"use client";

import { useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";

export type DatoAcceso = { etiqueta: string; valor: string };

/**
 * "Cómo entrar": enlace de la plataforma, usuario y contraseña del video, a
 * la vista y con un botón que copia el mensaje completo (video + acceso) para
 * pegarlo en WhatsApp o en un correo.
 */
export function AccesoVideo({ datos, titulo }: { datos: DatoAcceso[]; titulo: string }) {
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    const texto = [`📹 ${titulo}`, "", `Video: ${window.location.href}`, ...datos.map((d) => `${d.etiqueta}: ${d.valor}`)].join("\n");
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2200);
    } catch {}
  };
  return (
    <section className="vt-acceso" aria-label="Cómo entrar">
      <header>
        <KeyRound className="h-4 w-4" aria-hidden="true" />
        <b>Cómo entrar</b>
      </header>
      <dl>
        {datos.map((d) => (
          <div key={d.etiqueta}>
            <dt>{d.etiqueta}</dt>
            <dd>
              {/^https?:\/\//.test(d.valor) ? (
                <a href={d.valor} target="_blank" rel="noreferrer">
                  {d.valor}
                </a>
              ) : (
                <code>{d.valor}</code>
              )}
            </dd>
          </div>
        ))}
      </dl>
      <button type="button" className="vt-grande" onClick={copiar}>
        {copiado ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
        {copiado ? "Copiado: pégalo en WhatsApp" : "Copiar enlace y datos de acceso"}
      </button>
    </section>
  );
}
