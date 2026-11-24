import { ChevronDown } from "lucide-react";
import type { FilaAgenda } from "@/lib/agenda-estudiante";
import { FilaDeAgenda, SeccionAgenda } from "@/components/agenda/fila-agenda";

/**
 * Las tres listas de la agenda, en orden de tiempo: lo que pasa ahora, lo que
 * viene con fecha y lo que el área aún no agenda. Las usan «Mis
 * capacitaciones» (toda la agenda) y la ficha de un plan (solo ese plan), para
 * que las dos pantallas se lean igual.
 */
export function ListasAgenda({ filas, vacio }: { filas: FilaAgenda[]; vacio: { titulo: string; texto: string } }) {
  const ahora = filas.filter((f) => f.momento === "EN_VIVO" || f.momento === "FINALIZADA");
  const proximas = filas.filter((f) => f.momento === "PROXIMA");
  const sinFecha = filas.filter((f) => f.momento === "SIN_FECHA");
  const enVivo = ahora.some((f) => f.momento === "EN_VIVO");

  // «Próximas» agrupadas por día, en el orden en que ya vienen (por fecha).
  const grupos: { titulo: string; filas: FilaAgenda[] }[] = [];
  for (const f of proximas) {
    const titulo = f.grupo ?? "Más adelante";
    const ultimo = grupos.at(-1);
    if (ultimo?.titulo === titulo) ultimo.filas.push(f);
    else grupos.push({ titulo, filas: [f] });
  }

  if (filas.length === 0) {
    return (
      <div className="agenda-panel">
        <p className="agenda-vacio">
          <b>{vacio.titulo}</b>
          {vacio.texto}
        </p>
      </div>
    );
  }

  return (
    <>
      {ahora.length > 0 && (
        <SeccionAgenda
          titulo="Ahora"
          conteo={ahora.length}
          tono={enVivo ? "vivo" : undefined}
          ayuda="En vivo y lo de las últimas 24 horas: aún puedes presentar lo pendiente."
        >
          <ul>
            {ahora.map((f) => (
              <FilaDeAgenda key={f.id} fila={f} />
            ))}
          </ul>
        </SeccionAgenda>
      )}

      {proximas.length > 0 && (
        <SeccionAgenda titulo="Próximas" conteo={proximas.length} ayuda="Con fecha y hora confirmadas, de la más cercana a la más lejana.">
          {grupos.map((g) => (
            <div key={g.titulo}>
              <p className="agenda-grupo">{g.titulo}</p>
              <ul>
                {g.filas.map((f) => (
                  <FilaDeAgenda key={f.id} fila={f} />
                ))}
              </ul>
            </div>
          ))}
        </SeccionAgenda>
      )}

      {sinFecha.length > 0 && (
        // Plegada cuando es larga o hay algo con fecha: son las líneas del plan
        // que aún no tienen día; informan, pero no hay nada que hacer hoy.
        <details className="agenda-panel group" open={sinFecha.length <= 6 && ahora.length + proximas.length === 0}>
          <summary className="agenda-cabecera">
            <h2>
              Programadas, aún sin fecha
              <span className="agenda-conteo">{sinFecha.length}</span>
            </h2>
            <p className="inline-flex items-center gap-1.5">
              Previstas para este trimestre o los siguientes
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
            </p>
          </summary>
          <ul>
            {sinFecha.map((f) => (
              <FilaDeAgenda key={f.id} fila={f} />
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
