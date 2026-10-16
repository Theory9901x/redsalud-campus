import Link from "next/link";
import type { CSSProperties } from "react";
import { Activity, ArrowDownRight, ArrowUpRight, BarChart3, Building2, CalendarRange, ClipboardList, GitCompareArrows, Minus, Percent, TrendingUp } from "lucide-react";
import { BotonExportar, CifraSiau } from "@/components/encuestas/siau/movimiento";
import { semDe, TEXTO_SEM, type SemSiau } from "@/components/encuestas/siau/semaforo";

/** Anillo de adherencia: pozo circular, arco con el color pleno del semáforo y cifra al centro. */
export function AnilloSiau({ valor, tamano = 156, grosor = 11, etiqueta = "Adherencia" }: { valor: number | null; tamano?: number; grosor?: number; etiqueta?: string }) {
  const sem = semDe(valor);
  const r = tamano / 2 - grosor / 2 - 7;
  const total = 2 * Math.PI * r;
  const lleno = valor === null ? 0 : Math.max(0, Math.min(100, valor)) / 100;
  const centro = tamano - 2 * (grosor + 15);
  return (
    <div className="siau-anillo" data-siau-sem={sem} style={{ width: tamano, height: tamano }} role="img" aria-label={`${etiqueta}: ${valor === null ? "sin datos" : `${valor}%`} (${TEXTO_SEM[sem]})`}>
      <svg width={tamano} height={tamano} viewBox={`0 0 ${tamano} ${tamano}`} aria-hidden="true">
        <circle cx={tamano / 2} cy={tamano / 2} r={r} fill="none" stroke="color-mix(in oklch, var(--foreground) 7%, transparent)" strokeWidth={grosor} />
        {valor !== null && (
          <circle
            className="siau-anillo-arco"
            cx={tamano / 2}
            cy={tamano / 2}
            r={r}
            fill="none"
            stroke="var(--sem)"
            strokeWidth={grosor}
            strokeLinecap="round"
            strokeDasharray={total}
            strokeDashoffset={total * (1 - lleno)}
            style={{ ["--siau-arco-total" as string]: total } as CSSProperties}
          />
        )}
      </svg>
      <div className="siau-anillo-centro" style={{ width: centro, height: centro }}>
        <b style={{ fontSize: tamano * 0.17 }}>
          <CifraSiau valor={valor} sufijo="%" />
        </b>
        <span>{etiqueta}</span>
      </div>
    </div>
  );
}

export function SemaforoSiau({ sem, texto }: { sem: SemSiau; texto?: string }) {
  return (
    <span className="siau-sem" data-siau-sem={sem}>
      {texto ?? TEXTO_SEM[sem]}
    </span>
  );
}

/**
 * CABECERA del centro de datos: qué encuesta es, qué periodo se está
 * mirando y las lecturas principales. La adherencia es el instrumento
 * (anillo + semáforo); el resto son lecturas hundidas en la arcilla.
 */
export function CabeceraSiau({
  codigo,
  titulo,
  encuestaId,
  periodo,
  periodoPrevio,
  adherencia,
  total,
  totalPrevio,
  variacion,
  puntaje,
  sedes,
}: {
  codigo: string;
  titulo: string;
  encuestaId: string;
  periodo: string;
  periodoPrevio: string;
  adherencia: number | null;
  total: number;
  totalPrevio: number | null;
  variacion: number | null;
  puntaje: number | null;
  sedes: { conDatos: number; verde: number; amarillo: number; rojo: number };
}) {
  const sem = semDe(adherencia);
  const IconoVar = variacion === null || variacion === 0 ? Minus : variacion > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <header className="siau-sup siau-cabecera siau-revelar">
      <div className="siau-cabecera-grid">
        <div className="min-w-0">
          <p className="siau-ceja">
            <Activity aria-hidden="true" />
            Centro de datos SIAU
            <em>· {codigo}</em>
          </p>
          <h1 className="siau-titulo">{titulo}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="siau-chip">
              <CalendarRange aria-hidden="true" />
              <span>{periodo}</span>
            </span>
            <span className="siau-chip">
              <GitCompareArrows aria-hidden="true" />
              <span>vs {periodoPrevio}</span>
            </span>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2.5 [&>*]:flex-1 sm:[&>*]:flex-none">
            <BotonExportar />
            <Link href={`/encuestas/${encuestaId}/resultados`} className="siau-boton">
              <BarChart3 aria-hidden="true" />
              Ficha de la encuesta
            </Link>
          </div>
        </div>

        <div className="siau-medidor">
          <AnilloSiau valor={adherencia} />
          <div>
            <SemaforoSiau sem={sem} />
            <ul className="siau-umbrales" aria-label="Umbrales del semáforo">
              <li>
                <span className="siau-punto" data-siau-sem="verde" />≥ 85 % cumple
              </li>
              <li>
                <span className="siau-punto" data-siau-sem="amarillo" />70–84,9 % aceptable
              </li>
              <li>
                <span className="siau-punto" data-siau-sem="rojo" />&lt; 70 % crítico
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="siau-kpis">
        <div className="siau-pozo siau-kpi">
          <div className="siau-kpi-cabeza">
            <span className="siau-mono">Encuestas</span>
            <ClipboardList aria-hidden="true" />
          </div>
          <b>
            <CifraSiau valor={total} />
          </b>
          <small>{totalPrevio === null ? "en el periodo" : `${totalPrevio} en el periodo anterior`}</small>
        </div>
        <div className="siau-pozo siau-kpi">
          <div className="siau-kpi-cabeza">
            <span className="siau-mono">Variación</span>
            <TrendingUp aria-hidden="true" />
          </div>
          <b className={`!flex items-center gap-1 ${variacion === null || variacion === 0 ? "" : variacion > 0 ? "siau-dif-pos" : "siau-dif-neg"}`}>
            <IconoVar aria-hidden="true" />
            <CifraSiau valor={variacion} sufijo=" pp" signo />
          </b>
          <small>{variacion === null ? "sin periodo previo con datos" : `adherencia frente a ${periodoPrevio}`}</small>
        </div>
        <div className="siau-pozo siau-kpi">
          <div className="siau-kpi-cabeza">
            <span className="siau-mono">Puntaje</span>
            <Percent aria-hidden="true" />
          </div>
          <b>
            <CifraSiau valor={puntaje} sufijo="%" />
          </b>
          <small>promedio de la escala sobre su máximo</small>
        </div>
        <div className="siau-pozo siau-kpi">
          <div className="siau-kpi-cabeza">
            <span className="siau-mono">Sedes con datos</span>
            <Building2 aria-hidden="true" />
          </div>
          <b>
            <CifraSiau valor={sedes.conDatos} />
          </b>
          <div className="siau-kpi-sem" aria-label="Sedes por semáforo">
            <span title="En verde">
              <i className="siau-punto" data-siau-sem="verde" />
              {sedes.verde}
            </span>
            <span title="En amarillo">
              <i className="siau-punto" data-siau-sem="amarillo" />
              {sedes.amarillo}
            </span>
            <span title="En rojo">
              <i className="siau-punto" data-siau-sem="rojo" />
              {sedes.rojo}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
