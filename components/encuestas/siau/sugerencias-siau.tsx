"use client";

import { CalendarDays, MapPin, MessageSquareText, Stethoscope } from "lucide-react";
import { useState } from "react";

export type SugerenciaSiau = { fecha: string; sede: string | null; servicio: string | null; texto: string; temas: string[] };

const PASO = 24;

/**
 * Sugerencias (P9) como tarjetas, con los temas como filtro: se pulsa un
 * tema y quedan solo sus comentarios. Las fechas llegan ya formateadas del
 * servidor (sin Intl en el cliente).
 */
export function SugerenciasSiau({ sugerencias, temas }: { sugerencias: SugerenciaSiau[]; temas: { tema: string; n: number }[] }) {
  const [tema, setTema] = useState<string | null>(null);
  const [visibles, setVisibles] = useState(PASO);
  const lista = tema === null ? sugerencias : tema === "Otros" ? sugerencias.filter((s) => s.temas.length === 0) : sugerencias.filter((s) => s.temas.includes(tema));
  const total = sugerencias.length;
  const sinTema = sugerencias.filter((s) => s.temas.length === 0).length;
  const opciones = [...temas, ...(sinTema > 0 ? [{ tema: "Otros", n: sinTema }] : [])];

  function elegir(t: string | null) {
    setTema(t);
    setVisibles(PASO);
  }

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]">
      <section className="siau-sup siau-tarjeta h-fit min-w-0 xl:sticky xl:top-24">
        <h2 className="siau-h2">
          <i>06</i>Temas
        </h2>
        <p className="siau-bajada">{total} comentarios agrupados por palabras clave. Pulsa un tema para filtrar.</p>
        <div className="mt-3 grid gap-1">
          <button type="button" className="siau-tema" aria-pressed={tema === null} onClick={() => elegir(null)}>
            <span>Todos los comentarios</span>
            <b>{total}</b>
          </button>
          {opciones.map((t) => (
            <button key={t.tema} type="button" className="siau-tema" aria-pressed={tema === t.tema} onClick={() => elegir(t.tema)}>
              <span className="truncate">{t.tema}</span>
              <b>{t.n}</b>
              <span className="siau-pista siau-pista-fina">
                <span style={{ width: `calc(${total ? (t.n / total) * 100 : 0}% - 0.24rem)` }} />
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="min-w-0" aria-label="Comentarios">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 px-1">
          <h2 className="siau-h2">
            <MessageSquareText aria-hidden="true" />
            {tema ?? "Sugerencias y comentarios (P9)"}
          </h2>
          <span className="siau-mono">
            {Math.min(visibles, lista.length)} de {lista.length}
          </span>
        </div>
        {lista.length === 0 ? (
          <div className="siau-pozo px-6 py-10 text-center text-[13px] text-muted-foreground">Sin comentarios en el periodo.</div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {lista.slice(0, visibles).map((s, i) => (
              <li key={`${s.fecha}-${i}`} className="siau-sugerencia">
                <p>{s.texto}</p>
                <footer>
                  <span>
                    <CalendarDays aria-hidden="true" />
                    {s.fecha}
                  </span>
                  {s.sede && (
                    <span className="truncate">
                      <MapPin aria-hidden="true" />
                      {s.sede}
                    </span>
                  )}
                  {s.servicio && (
                    <span className="truncate">
                      <Stethoscope aria-hidden="true" />
                      {s.servicio}
                    </span>
                  )}
                  {s.temas.length > 0 && <span className="siau-etiqueta-tema ml-auto">{s.temas.join(" · ")}</span>}
                </footer>
              </li>
            ))}
          </ul>
        )}
        {lista.length > visibles && (
          <div className="mt-4 flex justify-center">
            <button type="button" className="siau-boton" onClick={() => setVisibles((v) => v + PASO)}>
              Mostrar {Math.min(PASO, lista.length - visibles)} más
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
