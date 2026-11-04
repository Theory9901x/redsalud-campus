"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { configurarConvocatoria, renombrarCandidato } from "@/app/galardones/acciones";

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
  inicial: { abierta: boolean; cierraEl: string | null; anio: number };
  soloLectura: boolean;
}) {
  const router = useRouter();
  const [abierta, setAbierta] = useState(inicial.abierta);
  const [cierraEl, setCierraEl] = useState(inicial.cierraEl ? inicial.cierraEl.slice(0, 10) : "");
  const [anio, setAnio] = useState(String(inicial.anio));
  const [pendiente, startTransition] = useTransition();

  function guardar() {
    startTransition(async () => {
      const r = await configurarConvocatoria({ abierta, cierraEl: cierraEl || null, anio: Number(anio) });
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
