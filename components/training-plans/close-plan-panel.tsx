"use client";

import { useActionState, useState, useTransition } from "react";
import { Lock, Unlock, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { ClosePlanState } from "@/app/admin/planes-capacitacion/actions";

const INICIAL: ClosePlanState = { error: null };

export type ResumenCierre = {
  totalActividades: number;
  conCurso: number;
  jornadasCerradas: number;
  cumplimiento: number | null;
};

/**
 * El cierre del plan como acta, no como clic: muestra el resumen de lo que
 * se está cerrando, lista lo que todavía lo impide, y exige observaciones.
 * Si hay bloqueos el botón de confirmar ni se ofrece -mandar a alguien a un
 * error evitable es hacerle perder el viaje-.
 */
export function ClosePlanPanel({
  estado,
  resumen,
  bloqueos,
  acta,
  puedeReabrir,
  onClose,
  onReopen,
}: {
  estado: "ACTIVE" | "CLOSED" | "DRAFT" | "ARCHIVED";
  resumen: ResumenCierre;
  bloqueos: string[];
  /** Solo cuando está cerrado: el acta ya formateada en el servidor. */
  acta: { fecha: string; por: string; observaciones: string } | null;
  puedeReabrir: boolean;
  onClose: (state: ClosePlanState, formData: FormData) => Promise<ClosePlanState>;
  onReopen: () => Promise<ClosePlanState>;
}) {
  const [abierto, setAbierto] = useState(false);
  const [state, formAction, enviando] = useActionState(onClose, INICIAL);
  const [reabriendo, iniciarReapertura] = useTransition();

  if (estado === "CLOSED" && acta) {
    return (
      <div className="surface-panel flex flex-wrap items-start justify-between gap-4 border-l-4 border-l-navy p-5">
        <div className="min-w-0 space-y-1">
          <p className="flex items-center gap-1.5 font-display text-sm font-bold text-foreground">
            <Lock className="h-4 w-4" aria-hidden="true" />
            Plan cerrado
          </p>
          <p className="text-xs text-muted-foreground">
            Cerrado el {acta.fecha} por {acta.por}. Solo consulta y exportación.
          </p>
          <p className="max-w-[560px] text-sm leading-relaxed text-foreground/85">{acta.observaciones}</p>
        </div>
        {puedeReabrir && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={reabriendo}
            onClick={() =>
              iniciarReapertura(async () => {
                const r = await onReopen();
                if (r.error) toast.error(r.error);
              })
            }
            className="gap-1.5"
          >
            {reabriendo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlock className="h-3.5 w-3.5" />}
            Reabrir plan
          </Button>
        )}
      </div>
    );
  }

  if (estado !== "ACTIVE") return null;

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setAbierto(true)} className="gap-1.5">
        <Lock className="h-3.5 w-3.5" aria-hidden="true" />
        Cerrar plan
      </Button>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>¿Cerrar este plan de capacitación?</DialogTitle>
            <DialogDescription>
              Al cerrarlo, los indicadores quedan definitivos y el plan pasa a solo consulta. Reabrirlo requiere
              permiso de administrador.
            </DialogDescription>
          </DialogHeader>

          <dl className="grid grid-cols-2 gap-3 rounded-lg border border-border p-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Capacitaciones</dt>
              <dd className="font-semibold text-foreground">{resumen.totalActividades}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Con contenido</dt>
              <dd className="font-semibold text-foreground">{resumen.conCurso}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Jornadas cerradas</dt>
              <dd className="font-semibold text-foreground">{resumen.jornadasCerradas}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Cumplimiento</dt>
              <dd className="font-semibold text-foreground">
                {resumen.cumplimiento !== null ? `${resumen.cumplimiento}%` : "Sin datos"}
              </dd>
            </div>
          </dl>

          {bloqueos.length > 0 ? (
            <div className="space-y-1.5 rounded-lg bg-warning/10 p-3">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-warning">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                Todavía no se puede cerrar
              </p>
              <ul className="space-y-1 text-xs text-foreground/80">
                {bloqueos.map((b, i) => (
                  <li key={i}>· {b}</li>
                ))}
              </ul>
            </div>
          ) : (
            <form action={formAction} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="observaciones">Observaciones de cierre</Label>
                <textarea
                  id="observaciones"
                  name="observaciones"
                  required
                  minLength={10}
                  rows={3}
                  placeholder="Hallazgos, pendientes que pasan a la siguiente vigencia, constancia del cierre…"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              {state.error && <p className="text-sm text-destructive">{state.error}</p>}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAbierto(false)} disabled={enviando}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={enviando} className="gap-1.5">
                  {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
                  {enviando ? "Cerrando…" : "Cerrar plan"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
