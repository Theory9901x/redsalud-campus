"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2, Merge, Scissors, Trophy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { valorInfo } from "@/lib/galardones/valores";
import type { CandidatoResultado, ResultadoIps, ResultadosGalardones } from "@/lib/galardones/consultas";
import { fusionarCandidatos, separarVariante } from "@/app/galardones/acciones";

const TODAS = "__todas";
type Ejecutar = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>, exito: string) => void;

/** Color de cada valor como tono oklch, para el acento de columnas y barras. */
const tono = (matiz: number, l = 0.62, c = 0.13) => `oklch(${l} ${c} ${matiz})`;

/**
 * RESULTADOS en el panel admin (tema claro): por centro IPS, quién lleva más
 * postulaciones en cada valor. Desde cada candidato se corrige la agrupación
 * automática de nombres (fusionar / separar).
 */
export function ResultadosGalardonesAdmin({ resultados, soloLectura }: { resultados: ResultadosGalardones; soloLectura: boolean }) {
  const router = useRouter();
  const [ips, setIps] = useState<string>(TODAS);
  const [pendiente, startTransition] = useTransition();
  const seleccion = useMemo(() => resultados.porIps.find((i) => i.ips === ips) ?? null, [resultados, ips]);

  const ejecutar: Ejecutar = (fn, exito) => {
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
    <section className="space-y-4" aria-label="Resultados por centro">
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Centro IPS">
        <Chip activo={ips === TODAS} onClick={() => setIps(TODAS)}>
          Todos los centros
        </Chip>
        {resultados.porIps.map((i) => (
          <Chip key={i.ips} activo={ips === i.ips} vacio={i.total === 0} onClick={() => setIps(i.ips)}>
            {i.ips}
            <span className="ml-1.5 rounded-full bg-foreground/[0.06] px-1.5 text-[10px] tabular-nums">{i.total}</span>
          </Chip>
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

function Chip({ activo, vacio, onClick, children }: { activo: boolean; vacio?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={activo}
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-colors",
        activo ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:border-primary/40",
        vacio && !activo && "text-muted-foreground/70",
      )}
    >
      {children}
    </button>
  );
}

/** Vista general: por cada centro, quién va primero en cada valor. */
function Podio({ porIps, onVer }: { porIps: ResultadoIps[]; onVer: (ips: string) => void }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {porIps.map((i) => (
        <article key={i.ips} className={cn("surface-panel flex flex-col p-5", i.total === 0 && "opacity-70")}>
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-display text-[1.05rem] font-extrabold text-foreground">{i.ips}</h3>
            <span className="shrink-0 text-[11.5px] text-muted-foreground">
              {i.total} postulaciones · {i.votantes} personas
            </span>
          </div>
          <dl className="mt-4 space-y-2.5">
            {i.valores.map((v) => {
              const lider = v.candidatos[0];
              const info = valorInfo(v.valor);
              return (
                <div key={v.valor} className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-2 rounded-xl border border-border/60 bg-background/70 px-3 py-2">
                  <dt className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: tono(info.matiz, 0.5) }}>
                    <span className="h-2 w-2 rounded-full" style={{ background: tono(info.matiz) }} aria-hidden="true" />
                    {info.nombre}
                  </dt>
                  <dd className="min-w-0 truncate text-[13px] font-semibold text-foreground">
                    {lider ? (
                      <>
                        {lider.nombre}
                        {v.empate && <span className="ml-1.5 rounded-full bg-warning/15 px-1.5 text-[10px] font-bold uppercase text-warning-foreground">empate</span>}
                      </>
                    ) : (
                      <span className="font-normal text-muted-foreground">Sin postulaciones</span>
                    )}
                  </dd>
                  <dd className="text-[12px] font-bold tabular-nums text-muted-foreground">{lider ? `${lider.votos} · ${lider.porcentaje}%` : ""}</dd>
                </div>
              );
            })}
          </dl>
          {i.total > 0 && (
            <Button type="button" variant="outline" size="sm" className="mt-4 self-start" onClick={() => onVer(i.ips)}>
              Ver detalle y corregir nombres
            </Button>
          )}
        </article>
      ))}
    </div>
  );
}

function DetalleIps({ ips, soloLectura, pendiente, ejecutar }: { ips: ResultadoIps; soloLectura: boolean; pendiente: boolean; ejecutar: Ejecutar }) {
  const todos = useMemo(() => {
    const m = new Map<string, { id: string; nombre: string; valores: string[] }>();
    for (const v of ips.valores)
      for (const c of v.candidatos) {
        const prev = m.get(c.id);
        if (prev) prev.valores.push(valorInfo(v.valor).nombre);
        else m.set(c.id, { id: c.id, nombre: c.nombre, valores: [valorInfo(v.valor).nombre] });
      }
    return [...m.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [ips]);

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      {ips.valores.map((v) => {
        const info = valorInfo(v.valor);
        return (
          <div key={v.valor} className="surface-panel overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-3" style={{ boxShadow: `inset 0 3px 0 ${tono(info.matiz)}` }}>
              <h3 className="font-display text-[1rem] font-extrabold text-foreground">
                {info.numero}. {info.nombre}
              </h3>
              <span className="text-[11.5px] text-muted-foreground">
                {v.total} postulaciones{v.empate ? " · empate" : ""}
              </span>
            </div>
            {v.candidatos.length === 0 ? (
              <p className="px-4 py-8 text-center text-[12.5px] text-muted-foreground">Sin postulaciones todavía.</p>
            ) : (
              <ol className="divide-y divide-border/60">
                {v.candidatos.map((c, i) => (
                  <Fila
                    key={c.id}
                    c={c}
                    pos={i + 1}
                    lider={i === 0 && !v.empate}
                    matiz={info.matiz}
                    otros={todos.filter((t) => t.id !== c.id)}
                    soloLectura={soloLectura}
                    pendiente={pendiente}
                    ejecutar={ejecutar}
                  />
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
  matiz,
  otros,
  soloLectura,
  pendiente,
  ejecutar,
}: {
  c: CandidatoResultado;
  pos: number;
  lider: boolean;
  matiz: number;
  otros: { id: string; nombre: string; valores: string[] }[];
  soloLectura: boolean;
  pendiente: boolean;
  ejecutar: Ejecutar;
}) {
  const [abierto, setAbierto] = useState(false);
  const [destino, setDestino] = useState("");
  return (
    <li className={cn("px-4 py-3", lider && "bg-warning/[0.06]")}>
      <button type="button" className="grid w-full grid-cols-[1.5rem_1fr_auto] items-center gap-2 text-left" onClick={() => setAbierto((a) => !a)} aria-expanded={abierto}>
        <span className="text-[11px] font-bold tabular-nums text-muted-foreground">
          {lider ? <Trophy className="h-3.5 w-3.5 text-warning-foreground" aria-label="Primer lugar" /> : pos}
        </span>
        <span className="min-w-0 truncate text-[13.5px] font-semibold text-foreground">
          {c.nombre}
          {c.registrado && <span className="ml-1.5 rounded-full border border-primary/30 bg-primary/10 px-1.5 text-[9.5px] font-bold uppercase tracking-wider text-primary">campus</span>}
        </span>
        <span className="flex items-center gap-1 text-[12.5px] font-bold tabular-nums text-foreground">
          {c.votos}
          <span className="font-medium text-muted-foreground">· {c.porcentaje}%</span>
          <ChevronDown className={cn("ml-0.5 h-3.5 w-3.5 text-muted-foreground transition-transform", abierto && "rotate-180")} aria-hidden="true" />
        </span>
      </button>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-foreground/[0.06]">
        <i className="block h-full rounded-full" style={{ width: `${c.porcentaje}%`, background: tono(matiz) }} />
      </div>

      {abierto && (
        <div className="mt-3 space-y-3 border-t border-dashed border-border/70 pt-3 text-[12.5px]">
          <div>
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">Cómo lo escribieron</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {c.variantes.map((v) => (
                <span key={v.texto} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1">
                  <b className="font-semibold">{v.texto}</b>
                  <span className="text-muted-foreground">×{v.veces}</span>
                  {!soloLectura && c.variantes.length > 1 && (
                    <button
                      type="button"
                      disabled={pendiente}
                      title="No es la misma persona: contarla aparte"
                      className="inline-flex items-center gap-0.5 rounded-full px-1 text-[10.5px] font-semibold text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        if (confirm(`¿«${v.texto}» no es ${c.nombre}? Sus ${v.veces} postulación(es) pasarán a contar aparte.`)) {
                          ejecutar(() => separarVariante(c.id, v.texto), "Candidato separado.");
                        }
                      }}
                    >
                      <Scissors className="h-3 w-3" aria-hidden="true" />
                      separar
                    </button>
                  )}
                </span>
              ))}
            </div>
          </div>
          {c.motivos.length > 0 && (
            <div>
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">Comportamientos descritos</p>
              <ul className="mt-1.5 list-disc space-y-1 pl-4 leading-relaxed text-muted-foreground">
                {c.motivos.slice(0, 6).map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
                {c.motivos.length > 6 && <li className="list-none opacity-70">… y {c.motivos.length - 6} más (en el Excel o en la pestaña Postulaciones).</li>}
              </ul>
            </div>
          )}
          {!soloLectura && otros.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <Merge className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              <span className="text-muted-foreground">Es la misma persona que</span>
              <select
                className="h-8 min-w-[12rem] rounded-md border border-border bg-background px-2 text-[12.5px]"
                value={destino}
                onChange={(e) => setDestino(e.target.value)}
                aria-label="Fusionar con"
              >
                <option value="">Elegir…</option>
                {otros.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nombre} ({o.valores.join(", ")})
                  </option>
                ))}
              </select>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!destino || pendiente}
                onClick={() => {
                  const o = otros.find((x) => x.id === destino);
                  if (o && confirm(`Las postulaciones de «${c.nombre}» pasarán a «${o.nombre}». ¿Fusionar?`)) {
                    ejecutar(() => fusionarCandidatos(c.id, destino), "Candidatos fusionados.");
                  }
                }}
              >
                {pendiente ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
                Fusionar
              </Button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
