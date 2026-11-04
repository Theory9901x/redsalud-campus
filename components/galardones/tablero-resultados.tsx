"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Download, Loader2, Merge, Trophy } from "lucide-react";
import { toast } from "sonner";
import type { GalardonValor } from "@prisma/client";
import { VALORES_GALARDON, valorInfo } from "@/lib/galardones/valores";
import type { CandidatoResultado, ResultadoIps, ResultadosGalardones } from "@/lib/galardones/consultas";
import { configurarConvocatoria, fusionarCandidatos, separarVariante } from "@/app/galardones/acciones";

const TODAS = "__todas";
const FECHA = new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeZone: "America/Bogota" });

export function TableroResultados({
  resultados,
  convocatoria,
  soloLectura,
}: {
  resultados: ResultadosGalardones;
  convocatoria: { abierta: boolean; cierraEl: string | null };
  soloLectura: boolean;
}) {
  const router = useRouter();
  const [ips, setIps] = useState<string>(TODAS);
  const [pendiente, startTransition] = useTransition();
  const [abierta, setAbierta] = useState(convocatoria.abierta);
  const [cierraEl, setCierraEl] = useState(convocatoria.cierraEl ? convocatoria.cierraEl.slice(0, 10) : "");

  const seleccion = useMemo(() => resultados.porIps.find((i) => i.ips === ips) ?? null, [resultados, ips]);

  const ejecutar = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>, exito: string) => {
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(exito);
      router.refresh();
    });
  };

  return (
    <section className="mt-2" aria-label="Tablero de resultados">
      <div className="gala-kpis">
        <Kpi etiqueta="Postulaciones" valor={resultados.totalPostulaciones} nota="Una por valor y por persona" />
        <Kpi etiqueta="Colaboradores" valor={resultados.totalVotantes} nota="Han postulado" />
        <Kpi etiqueta="Personas postuladas" valor={resultados.totalCandidatos} nota="Agrupadas por nombre" />
        <Kpi etiqueta="Centros con participación" valor={resultados.ipsConParticipacion} nota={`de ${resultados.porIps.length} IPS`} />
      </div>

      <div className="gala-panel gala-config">
        <span className="gala-estado" data-on={abierta || undefined}>
          Convocatoria {abierta ? "abierta" : "cerrada"}
        </span>
        {!soloLectura && (
          <>
            <label>
              <button type="button" className="gala-interruptor" data-on={abierta || undefined} role="switch" aria-checked={abierta} onClick={() => setAbierta((a) => !a)} />
              Recibir postulaciones
            </label>
            <label>
              Cierra el
              <input type="date" value={cierraEl} onChange={(e) => setCierraEl(e.target.value)} aria-label="Fecha de cierre" />
            </label>
            <button
              type="button"
              className="gala-btn gala-btn-sutil gala-btn-mini"
              disabled={pendiente}
              onClick={() => ejecutar(() => configurarConvocatoria({ abierta, cierraEl: cierraEl || null }), "Convocatoria actualizada.")}
            >
              {pendiente ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null} Guardar
            </button>
          </>
        )}
        {convocatoria.cierraEl && <span className="gala-ayuda">Plazo registrado: {FECHA.format(new Date(convocatoria.cierraEl))}</span>}
        <a href="/api/galardones/excel" className="gala-btn gala-btn-sutil gala-btn-mini ml-auto" download>
          <Download className="h-3.5 w-3.5" aria-hidden="true" /> Exportar a Excel
        </a>
      </div>

      <div className="gala-filtro-ips" role="tablist" aria-label="Centro IPS">
        <button type="button" role="tab" aria-selected={ips === TODAS} data-activo={ips === TODAS || undefined} onClick={() => setIps(TODAS)}>
          Todos los centros
        </button>
        {resultados.porIps.map((i) => (
          <button
            key={i.ips}
            type="button"
            role="tab"
            aria-selected={ips === i.ips}
            data-activo={ips === i.ips || undefined}
            data-vacio={i.total === 0 || undefined}
            onClick={() => setIps(i.ips)}
          >
            {i.ips}
            <i>{i.total}</i>
          </button>
        ))}
      </div>

      {seleccion ? (
        <DetalleIps ips={seleccion} soloLectura={soloLectura} pendiente={pendiente} ejecutar={ejecutar} />
      ) : (
        <Podio porIps={resultados.porIps} onVer={setIps} />
      )}
    </section>
  );
}

function Kpi({ etiqueta, valor, nota }: { etiqueta: string; valor: number; nota: string }) {
  return (
    <div className="gala-panel gala-kpi">
      <span className="gala-mono">{etiqueta}</span>
      <b>{valor}</b>
      <small>{nota}</small>
    </div>
  );
}

/** Vista general: por cada centro, quién va primero en cada valor. Las "3 postulaciones por IPS". */
function Podio({ porIps, onVer }: { porIps: ResultadoIps[]; onVer: (ips: string) => void }) {
  return (
    <div className="gala-podio">
      {porIps.map((i) => (
        <article key={i.ips} className="gala-panel gala-podio-ips" data-vacio={i.total === 0 || undefined}>
          <h3>
            {i.ips}
            <span>
              {i.total} postulaciones · {i.votantes} personas
            </span>
          </h3>
          <dl>
            {i.valores.map((v) => {
              const lider = v.candidatos[0];
              const info = valorInfo(v.valor);
              return (
                <div key={v.valor} style={{ ["--g-h" as string]: info.matiz }}>
                  <dt>{info.nombre}</dt>
                  <dd>
                    {lider ? (
                      <>
                        <span>
                          {lider.nombre}
                          {v.empate ? <i> · empate</i> : null}
                        </span>
                        <small>
                          {lider.votos} · {lider.porcentaje}%
                        </small>
                      </>
                    ) : (
                      <i>Sin postulaciones</i>
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
          {i.total > 0 && (
            <button type="button" className="gala-btn gala-btn-sutil gala-btn-mini mt-3" onClick={() => onVer(i.ips)}>
              Ver detalle
            </button>
          )}
        </article>
      ))}
    </div>
  );
}

function DetalleIps({
  ips,
  soloLectura,
  pendiente,
  ejecutar,
}: {
  ips: ResultadoIps;
  soloLectura: boolean;
  pendiente: boolean;
  ejecutar: (fn: () => Promise<{ ok: true } | { ok: false; error: string }>, exito: string) => void;
}) {
  // Todos los candidatos del centro, para ofrecer destinos de fusión.
  const todos = useMemo(() => {
    const m = new Map<string, { id: string; nombre: string; valores: string[] }>();
    for (const v of ips.valores) for (const c of v.candidatos) {
      const prev = m.get(c.id);
      if (prev) prev.valores.push(valorInfo(v.valor).nombre);
      else m.set(c.id, { id: c.id, nombre: c.nombre, valores: [valorInfo(v.valor).nombre] });
    }
    return [...m.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [ips]);

  return (
    <div className="gala-columnas">
      {ips.valores.map((v) => {
        const info = VALORES_GALARDON.find((x) => x.clave === v.valor)!;
        return (
          <div key={v.valor} className="gala-panel gala-panel-borde gala-col" style={{ ["--g-h" as string]: info.matiz }}>
            <div className="gala-col-cab">
              <h3>{info.nombre}</h3>
              <span>
                {v.total} postulaciones{v.empate ? " · empate" : ""}
              </span>
            </div>
            {v.candidatos.length === 0 ? (
              <p className="gala-vacio">Sin postulaciones todavía.</p>
            ) : (
              <ol className="gala-ranking">
                {v.candidatos.map((c, i) => (
                  <Fila key={c.id} c={c} pos={i + 1} lider={i === 0 && !v.empate} valor={v.valor} otros={todos.filter((t) => t.id !== c.id)} soloLectura={soloLectura} pendiente={pendiente} ejecutar={ejecutar} />
                ))}
              </ol>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Fila({
  c,
  pos,
  lider,
  otros,
  soloLectura,
  pendiente,
  ejecutar,
}: {
  c: CandidatoResultado;
  pos: number;
  lider: boolean;
  valor: GalardonValor;
  otros: { id: string; nombre: string; valores: string[] }[];
  soloLectura: boolean;
  pendiente: boolean;
  ejecutar: (fn: () => Promise<{ ok: true } | { ok: false; error: string }>, exito: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [destino, setDestino] = useState("");
  return (
    <li className="gala-fila" data-lider={lider || undefined} data-abierto={abierto || undefined}>
      <button type="button" className="gala-fila-cab" onClick={() => setAbierto((a) => !a)} aria-expanded={abierto}>
        <span className="gala-pos">{lider ? <Trophy className="h-3.5 w-3.5" aria-label="Primer lugar" /> : pos}</span>
        <span className="gala-fila-nombre">
          {c.nombre}
          {c.registrado ? <small>campus</small> : null}
        </span>
        <span className="gala-votos">
          {c.votos}
          <small>{c.porcentaje}%</small>
          <ChevronDown className="ml-1 inline h-3.5 w-3.5 opacity-60" aria-hidden="true" />
        </span>
      </button>
      <div className="gala-barra">
        <i style={{ width: `${c.porcentaje}%` }} />
      </div>
      {abierto && (
        <div className="gala-fila-detalle">
          <div>
            <span className="gala-mono">Cómo lo escribieron</span>
            <div className="gala-variantes mt-1">
              {c.variantes.map((v) => (
                <span key={v.texto} className="gala-variante">
                  <b>{v.texto}</b> ×{v.veces}
                  {!soloLectura && c.variantes.length > 1 && (
                    <button
                      type="button"
                      disabled={pendiente}
                      title="No es la misma persona: contarla aparte"
                      onClick={() => {
                        if (confirm(`¿«${v.texto}» no es ${c.nombre}? Sus ${v.veces} postulación(es) pasarán a contar aparte.`)) {
                          ejecutar(() => separarVariante(c.id, v.texto), "Candidato separado.");
                        }
                      }}
                    >
                      separar
                    </button>
                  )}
                </span>
              ))}
            </div>
          </div>
          {c.motivos.length > 0 && (
            <div>
              <span className="gala-mono">Comportamientos descritos</span>
              <ul className="gala-motivos mt-1">
                {c.motivos.slice(0, 6).map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
                {c.motivos.length > 6 && <li style={{ listStyle: "none", opacity: 0.6 }}>… y {c.motivos.length - 6} más (en el Excel).</li>}
              </ul>
            </div>
          )}
          {!soloLectura && otros.length > 0 && (
            <div className="gala-fusion">
              <Merge className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
              <span>Es la misma persona que</span>
              <select className="gala-select" value={destino} onChange={(e) => setDestino(e.target.value)} aria-label="Fusionar con">
                <option value="">Elegir…</option>
                {otros.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nombre} ({o.valores.join(", ")})
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="gala-btn gala-btn-sutil gala-btn-mini"
                disabled={!destino || pendiente}
                onClick={() => {
                  const o = otros.find((x) => x.id === destino);
                  if (o && confirm(`Las postulaciones de «${c.nombre}» pasarán a «${o.nombre}». ¿Fusionar?`)) {
                    ejecutar(() => fusionarCandidatos(c.id, destino), "Candidatos fusionados.");
                  }
                }}
              >
                Fusionar
              </button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
