"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Lock,
  Printer,
  QrCode,
  UserPlus,
  Users2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ORDEN_FASES, ETIQUETA_FASE } from "@/lib/sesiones-fases";
import {
  avanzarFaseAction,
  registrarAsistenciaManualAction,
  retrocederFaseAction,
} from "@/app/tutor/planes-capacitacion/sesiones-acciones";
import type { FaseSesion } from "@prisma/client";

type Asistente = { nombre: string; documento: string; hora: string; medio: string };

/**
 * FASE 10 — Panel EN VIVO de una sesión presencial, para el tutor.
 *
 * Controles de fase (avanzar/retroceder, cerrar con acta), contador de
 * asistentes en tiempo real (sondeo cada 10 s, suficiente para un
 * auditorio) y registro manual por documento para quien no puede escanear.
 */
export function PanelSesionVivo({
  sesionId,
  faseInicial,
  fichaUrl,
  asistentesIniciales,
}: {
  sesionId: string;
  faseInicial: FaseSesion;
  fichaUrl: string;
  asistentesIniciales: Asistente[];
}) {
  const router = useRouter();
  const [fase, setFase] = useState<FaseSesion>(faseInicial);
  const [asistentes, setAsistentes] = useState<Asistente[]>(asistentesIniciales);
  const [documento, setDocumento] = useState("");
  const [ocupado, startTransition] = useTransition();
  const cerrada = fase === "CERRADA";

  // Sondeo ligero: el contador debe moverse solo mientras la gente escanea.
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  useEffect(() => {
    if (cerrada) return;
    async function refrescar() {
      try {
        const r = await fetch(`/api/planes-capacitacion/sesiones/${sesionId}/asistentes`, { cache: "no-store" });
        if (!r.ok) return;
        const datos = await r.json();
        setAsistentes(datos.asistentes);
        setFase(datos.fase);
      } catch {
        // Sin red un instante: el siguiente tick lo corrige.
      }
    }
    timerRef.current = setInterval(refrescar, 10_000);
    return () => clearInterval(timerRef.current);
  }, [sesionId, cerrada]);

  function avanzar() {
    const indice = ORDEN_FASES.indexOf(fase);
    const siguiente = ORDEN_FASES[indice + 1];
    if (siguiente === "CERRADA" && !confirm("Cerrar la sesión congela su acta de totales. ¿Continuar?")) return;
    startTransition(async () => {
      const r = await avanzarFaseAction(sesionId);
      if (r.error) toast.error(r.error);
      else {
        setFase(siguiente);
        router.refresh();
      }
    });
  }

  function retroceder() {
    startTransition(async () => {
      const r = await retrocederFaseAction(sesionId);
      if (r.error) toast.error(r.error);
      else {
        setFase(ORDEN_FASES[Math.max(0, ORDEN_FASES.indexOf(fase) - 1)]);
        router.refresh();
      }
    });
  }

  function registrarManual() {
    if (documento.trim().length < 5) return;
    startTransition(async () => {
      const r = await registrarAsistenciaManualAction(sesionId, documento);
      if (r.error) toast.error(r.error);
      else {
        toast.success(r.nombre ?? "Registrado.");
        setDocumento("");
        const resp = await fetch(`/api/planes-capacitacion/sesiones/${sesionId}/asistentes`, { cache: "no-store" });
        if (resp.ok) setAsistentes((await resp.json()).asistentes);
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* Línea de fases */}
      <section className="surface-vivo">
        <div className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-[15px] font-bold uppercase tracking-wide text-foreground">
              Fase de la sesión
            </h2>
            <a
              href={fichaUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-card/70 px-3.5 py-2 text-[12.5px] font-bold text-foreground transition-colors hover:border-primary/40"
            >
              <Printer className="h-4 w-4 text-primary" />
              Ficha proyectable con QR
            </a>
          </div>

          <ol className="mt-5 flex flex-wrap items-center gap-2">
            {ORDEN_FASES.map((f, i) => {
              const indiceActual = ORDEN_FASES.indexOf(fase);
              const pasada = i < indiceActual;
              const actual = i === indiceActual;
              return (
                <li key={f} className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-bold transition-colors",
                      actual
                        ? "border-primary/50 bg-primary/12 text-primary"
                        : pasada
                          ? "border-success/40 bg-success/10 text-success"
                          : "border-border/60 bg-card/50 text-muted-foreground"
                    )}
                  >
                    {pasada ? <CheckCircle2 className="h-3.5 w-3.5" /> : f === "CERRADA" ? <Lock className="h-3.5 w-3.5" /> : null}
                    {ETIQUETA_FASE[f]}
                  </span>
                  {i < ORDEN_FASES.length - 1 && <span className="h-px w-4 bg-border" aria-hidden="true" />}
                </li>
              );
            })}
          </ol>

          {!cerrada && (
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={retroceder}
                disabled={ocupado || fase === "REGISTRO"}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-card/70 px-4 py-2.5 text-[13px] font-bold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
              >
                <ArrowLeft className="h-4 w-4" />
                Fase anterior
              </button>
              <button
                type="button"
                onClick={avanzar}
                disabled={ocupado}
                className={cn(
                  "inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-bold text-white shadow-md transition-transform hover:translate-y-[-1px] disabled:opacity-60",
                  ORDEN_FASES[ORDEN_FASES.indexOf(fase) + 1] === "CERRADA"
                    ? "bg-destructive"
                    : "bg-gradient-to-r from-primary to-success shadow-primary/25"
                )}
              >
                {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                {ORDEN_FASES[ORDEN_FASES.indexOf(fase) + 1] === "CERRADA"
                  ? "Cerrar sesión y congelar acta"
                  : `Pasar a: ${ETIQUETA_FASE[ORDEN_FASES[ORDEN_FASES.indexOf(fase) + 1]]}`}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Asistentes en vivo */}
      <section className="surface-lumen overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 px-5 py-4">
          <h2 className="flex items-center gap-2 font-display text-[15px] font-bold text-foreground">
            <Users2 className="h-4 w-4 text-primary" />
            Asistentes
            <span className="rounded-full bg-primary/12 px-2.5 py-0.5 font-display text-[15px] font-extrabold tabular-nums text-primary">
              {asistentes.length}
            </span>
            {!cerrada && (
              <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-success">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
                en vivo
              </span>
            )}
          </h2>

          {!cerrada && (
            <div className="flex items-center gap-2">
              <input
                value={documento}
                onChange={(e) => setDocumento(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && registrarManual()}
                inputMode="numeric"
                placeholder="Documento (registro manual)"
                aria-label="Registrar asistencia manual por documento"
                className="h-9 w-56 rounded-xl border border-input bg-background px-3 text-[13px] outline-none transition-colors focus:border-primary/50"
              />
              <button
                type="button"
                onClick={registrarManual}
                disabled={ocupado || documento.trim().length < 5}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3.5 text-[12.5px] font-bold text-primary-foreground disabled:opacity-50"
              >
                <UserPlus className="h-4 w-4" />
                Registrar
              </button>
            </div>
          )}
        </div>

        {asistentes.length === 0 ? (
          <p className="flex items-center gap-2 px-5 py-10 text-center text-[13.5px] text-muted-foreground">
            <QrCode className="h-4 w-4" />
            Nadie ha escaneado todavía. Proyecta la ficha con el QR para que el personal registre su llegada.
          </p>
        ) : (
          <ul className="divide-y divide-border/40">
            {asistentes.map((a, i) => (
              <li key={`${a.documento}-${i}`} className="flex items-center justify-between gap-3 px-5 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-semibold text-foreground">{a.nombre}</p>
                  <p className="text-[11.5px] text-muted-foreground">{a.documento}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[12.5px] font-semibold tabular-nums text-foreground">{a.hora}</p>
                  <p className={cn("text-[10.5px] font-bold uppercase", a.medio === "QR" ? "text-primary" : "text-warning-foreground")}>
                    {a.medio === "QR" ? "Escaneó" : "Manual"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
