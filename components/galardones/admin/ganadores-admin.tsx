"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Gavel, Loader2, Presentation, Trophy, Undo2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import type { GalardonValor } from "@prisma/client";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { valorInfo } from "@/lib/galardones/valores";
import type { Ganador, GanadoresIps, ResultadosGalardones } from "@/lib/galardones/consultas";
import { definirGanador, quitarDecision } from "@/app/galardones/acciones";
import { nombreCentro } from "@/lib/galardones/ips";

const ETIQUETA_ORIGEN: Record<Ganador["origen"], { texto: string; clase: string }> = {
  MAYORIA: { texto: "Más postulado", clase: "border-success/30 bg-success/10 text-success" },
  REASIGNADO: { texto: "Siguiente más postulado", clase: "border-primary/30 bg-primary/10 text-primary" },
  DECISION: { texto: "Definido por Talento Humano", clase: "border-[oklch(0.7_0.13_75/0.45)] bg-[oklch(0.72_0.13_75/0.12)] text-[oklch(0.45_0.1_68)]" },
  EMPATE: { texto: "Empate por definir", clase: "border-warning/40 bg-warning/15 text-warning-foreground" },
  SIN_POSTULACIONES: { texto: "Sin ganador", clase: "border-border bg-muted text-muted-foreground" },
};

/** Necesita decisión: empate, o nadie disponible habiendo postulados. */
const pendiente = (g: Ganador) => g.origen === "EMPATE" || (g.origen === "SIN_POSTULACIONES" && !!g.nota);

/**
 * GANADORES en el panel admin: exactamente lo que mostrará la ceremonia.
 * Tres personas distintas por centro, una por valor. Aquí Talento Humano
 * resuelve los empates antes del evento.
 */
export function GanadoresAdmin({ centros, resultados, soloLectura }: { centros: GanadoresIps[]; resultados: ResultadosGalardones; soloLectura: boolean }) {
  const [soloPendientes, setSoloPendientes] = useState(false);
  const pendientes = centros.reduce((n, c) => n + c.ganadores.filter(pendiente).length, 0);
  const lista = soloPendientes ? centros.filter((c) => c.ganadores.some(pendiente)) : centros;

  return (
    <section className="space-y-4" aria-label="Ganadores por centro">
      <div className="surface-panel flex flex-wrap items-center gap-3 p-4">
        <Gavel className="h-4.5 w-4.5 shrink-0 text-primary" aria-hidden="true" />
        <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-muted-foreground">
          En cada centro ganan <b className="text-foreground">tres personas distintas</b>, una por valor: la más postulada. Si alguien encabeza dos valores, se
          queda con el que más postulaciones tiene y el otro pasa al siguiente más postulado. Los empates los define Talento Humano aquí.
        </p>
        <Link href="/galardones/ceremonia" target="_blank" className={cn(buttonVariants({ size: "sm", variant: "outline" }), "gap-1.5")}>
          <Presentation className="h-3.5 w-3.5" aria-hidden="true" />
          Abrir ceremonia
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {pendientes > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-warning/40 bg-warning/15 px-3 py-1 text-[12.5px] font-semibold text-warning-foreground">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            {pendientes} {pendientes === 1 ? "galardón por definir" : "galardones por definir"}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-[12.5px] font-semibold text-success">
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            Sin empates pendientes
          </span>
        )}
        {pendientes > 0 && (
          <button
            type="button"
            onClick={() => setSoloPendientes((v) => !v)}
            className={cn(
              "rounded-full border px-3 py-1 text-[12.5px] font-semibold transition-colors",
              soloPendientes ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary/40",
            )}
          >
            {soloPendientes ? "Ver todos los centros" : "Ver solo los pendientes"}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {lista.map((c) => (
          <article key={c.ips} className="surface-panel overflow-hidden">
            <div className="flex items-baseline justify-between gap-3 border-b border-border/70 px-5 py-3.5">
              <h3 className="font-display text-[1.05rem] font-extrabold text-foreground">{nombreCentro(c.ips)}</h3>
              <span className="text-[11.5px] text-muted-foreground">
                {c.total} postulaciones · {c.votantes} personas
              </span>
            </div>
            <ul className="divide-y divide-border/60">
              {c.ganadores.map((g) => (
                <FilaGanador key={g.valor} ips={c.ips} g={g} resultados={resultados} soloLectura={soloLectura} />
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}

function FilaGanador({ ips, g, resultados, soloLectura }: { ips: string; g: Ganador; resultados: ResultadosGalardones; soloLectura: boolean }) {
  const router = useRouter();
  const info = valorInfo(g.valor);
  const [pendienteAccion, startTransition] = useTransition();
  const [elegido, setElegido] = useState("");
  const etiqueta = ETIQUETA_ORIGEN[g.origen];

  // Opciones para decidir: los empatados, o todos los postulados del valor si nadie quedó disponible.
  const opciones = useMemo(() => {
    if (g.origen === "EMPATE") return g.personas.map((p) => ({ id: p.id, nombre: p.nombre, votos: p.votos }));
    const v = resultados.porIps.find((i) => i.ips === ips)?.valores.find((x) => x.valor === g.valor);
    return (v?.candidatos ?? []).filter((x) => x.votos > 0).map((x) => ({ id: x.id, nombre: x.nombre, votos: x.votos }));
  }, [g, ips, resultados]);

  const ejecutar = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>, exito: string) =>
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(exito);
      setElegido("");
      router.refresh();
    });

  return (
    <li className="px-5 py-3.5">
      <div className="flex items-start gap-3">
        <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: `oklch(0.62 0.13 ${info.matiz})` }} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10.5px] font-bold uppercase tracking-wider" style={{ color: `oklch(0.48 0.13 ${info.matiz})` }}>
              {info.nombre}
            </p>
            <span className={cn("rounded-full border px-2 py-0.5 text-[10.5px] font-bold", etiqueta.clase)}>{etiqueta.texto}</span>
          </div>
          {g.personas.length ? (
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[14px] font-semibold text-foreground">
              {g.origen !== "EMPATE" && <Trophy className="h-3.5 w-3.5 text-[oklch(0.62_0.13_75)]" aria-hidden="true" />}
              {g.personas.map((p) => `${p.nombre} (${p.votos})`).join(" · ")}
            </p>
          ) : (
            <p className="mt-1 text-[13px] text-muted-foreground">Nadie</p>
          )}
          {g.nota && <p className="mt-0.5 text-[12px] text-muted-foreground">{g.nota}</p>}

          {!soloLectura && (pendiente(g) || g.origen === "DECISION") && (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {pendiente(g) && opciones.length > 0 && (
                <>
                  <select
                    value={elegido}
                    onChange={(e) => setElegido(e.target.value)}
                    className="h-8 min-w-[12rem] rounded-md border border-border bg-background px-2 text-[12.5px]"
                    aria-label={`Ganador de ${info.nombre} en ${ips}`}
                  >
                    <option value="">Elegir ganador…</option>
                    {opciones.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.nombre} ({o.votos})
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!elegido || pendienteAccion}
                    onClick={() => {
                      const o = opciones.find((x) => x.id === elegido);
                      if (o && confirm(`¿${o.nombre} gana ${info.nombre} en ${ips}?`)) ejecutar(() => definirGanador(ips, g.valor as GalardonValor, elegido), "Ganador definido.");
                    }}
                    className="gap-1.5"
                  >
                    {pendienteAccion ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    Definir
                  </Button>
                </>
              )}
              {g.origen === "DECISION" && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pendienteAccion}
                  onClick={() => {
                    if (confirm(`¿Quitar la decisión? ${info.nombre} en ${ips} vuelve a decidirse por el conteo.`)) ejecutar(() => quitarDecision(ips, g.valor as GalardonValor), "Decisión retirada.");
                  }}
                  className="gap-1.5"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                  Quitar decisión
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
