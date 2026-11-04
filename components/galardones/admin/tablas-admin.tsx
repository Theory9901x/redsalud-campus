"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { configurarConvocatoria, renombrarCandidato, revisarVotante } from "@/app/galardones/acciones";

/** Nombre de candidato editable en línea (lápiz → campo → guardar). */
export function NombreCandidatoEditable({ id, nombre, soloLectura }: { id: string; nombre: string; soloLectura: boolean }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(nombre);
  const [pendiente, startTransition] = useTransition();

  if (!editando || soloLectura) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <b className="font-semibold text-foreground">{nombre}</b>
        {!soloLectura && (
          <button type="button" onClick={() => setEditando(true)} className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Renombrar a ${nombre}`} title="Renombrar">
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </span>
    );
  }

  function guardar() {
    startTransition(async () => {
      const r = await renombrarCandidato(id, valor);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Nombre actualizado.");
      setEditando(false);
      router.refresh();
    });
  }

  return (
    <span className="inline-flex items-center gap-1">
      <Input
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") guardar();
          if (e.key === "Escape") setEditando(false);
        }}
        className="h-8 w-56 text-[13px]"
        autoFocus
        aria-label="Nuevo nombre"
      />
      <Button type="button" size="icon-sm" variant="ghost" onClick={guardar} disabled={pendiente} aria-label="Guardar nombre">
        {pendiente ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 text-success" />}
      </Button>
      <Button type="button" size="icon-sm" variant="ghost" onClick={() => { setEditando(false); setValor(nombre); }} aria-label="Cancelar">
        <X className="h-3.5 w-3.5" />
      </Button>
    </span>
  );
}

/** Configuración de la convocatoria: recibir postulaciones o no, fecha límite y año del reconocimiento. */
export function FormularioConvocatoria({
  inicial,
  soloLectura,
}: {
  inicial: { abierta: boolean; cierraEl: string | null; anio: number; cuentasNuevasDesde: string };
  soloLectura: boolean;
}) {
  const router = useRouter();
  const [abierta, setAbierta] = useState(inicial.abierta);
  const [cierraEl, setCierraEl] = useState(inicial.cierraEl ? inicial.cierraEl.slice(0, 10) : "");
  const [anio, setAnio] = useState(String(inicial.anio));
  const [corte, setCorte] = useState(inicial.cuentasNuevasDesde);
  const [pendiente, startTransition] = useTransition();

  function guardar() {
    startTransition(async () => {
      const r = await configurarConvocatoria({ abierta, cierraEl: cierraEl || null, anio: Number(anio), cuentasNuevasDesde: corte || null });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Convocatoria actualizada.");
      router.refresh();
    });
  }

  return (
    <div className="surface-panel max-w-2xl p-6">
      <h2 className="font-display text-[1.05rem] font-extrabold text-foreground">Convocatoria</h2>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Mientras esté abierta, cada colaborador puede diligenciar su postulación una única vez. Al cerrarla, o al pasar la fecha límite, el formulario deja
        de recibir postulaciones y muestra que el plazo terminó.
      </p>

      <div className="mt-5 space-y-5">
        <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-background/70 px-4 py-3">
          <div>
            <Label htmlFor="gal-abierta" className="text-[13.5px] font-semibold">
              Recibir postulaciones
            </Label>
            <p className="text-[12px] text-muted-foreground">Estado actual: {abierta ? "abierta" : "cerrada"}</p>
          </div>
          <Switch id="gal-abierta" checked={abierta} onCheckedChange={(v) => setAbierta(Boolean(v))} disabled={soloLectura} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="gal-cierra" className="text-[13px]">
              Fecha límite
            </Label>
            <Input id="gal-cierra" type="date" value={cierraEl} onChange={(e) => setCierraEl(e.target.value)} disabled={soloLectura} />
            <p className="text-[11.5px] text-muted-foreground">Informativa y de corte: ese día a las 11:59 p. m. cierra sola. Déjala vacía para cerrar a mano.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gal-anio" className="text-[13px]">
              Año del reconocimiento
            </Label>
            <Input id="gal-anio" type="number" min={2020} max={2100} value={anio} onChange={(e) => setAnio(e.target.value)} disabled={soloLectura} />
            <p className="text-[11.5px] text-muted-foreground">Sale en la cabecera del formulario y de esta gestión.</p>
          </div>
        </div>

        <div className="space-y-1.5 rounded-xl border border-warning/30 bg-warning/[0.06] p-4">
          <Label htmlFor="gal-corte" className="text-[13px] font-semibold">
            Cuentas nuevas por verificar desde
          </Label>
          <Input id="gal-corte" type="date" value={corte} onChange={(e) => setCorte(e.target.value)} disabled={soloLectura} className="max-w-[14rem]" />
          <p className="text-[11.5px] leading-relaxed text-muted-foreground">
            Cada cuenta postula una sola vez. Como el registro del campus es abierto, alguien podría crear más cuentas para postular de nuevo: las
            cuentas creadas en la plataforma desde esta fecha quedan <b>por verificar</b> y no suman hasta que las valides. Las cuentas importadas del
            plan de cargos y las de administradores o tutores siempre cuentan. El cambio aplica a las postulaciones nuevas.
          </p>
        </div>

        {!soloLectura && (
          <div className="flex justify-end">
            <Button type="button" onClick={guardar} disabled={pendiente} className="gap-1.5">
              {pendiente ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
              Guardar cambios
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Botones Validar / Anular de una cuenta por verificar. */
export function RevisionVotante({ votanteId, nombre }: { votanteId: string; nombre: string }) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  function decidir(decision: "VALIDA" | "ANULADA") {
    const texto =
      decision === "VALIDA"
        ? `¿${nombre} es colaborador de la institución? Sus postulaciones empezarán a sumar.`
        : `¿Anular las postulaciones de ${nombre}? No sumarán y esa cuenta no podrá volver a postular.`;
    if (!confirm(texto)) return;
    startTransition(async () => {
      const r = await revisarVotante(votanteId, decision);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(decision === "VALIDA" ? "Postulación validada." : "Postulación anulada.");
      router.refresh();
    });
  }
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" onClick={() => decidir("VALIDA")} disabled={pendiente} className="gap-1.5">
        {pendiente ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        Validar
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={() => decidir("ANULADA")} disabled={pendiente} className="gap-1.5 text-destructive hover:bg-destructive/10">
        <X className="h-3.5 w-3.5" />
        Anular
      </Button>
    </div>
  );
}
