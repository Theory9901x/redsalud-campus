"use client";

import { useActionState, useState, useTransition } from "react";
import { CalendarPlus, Check, Copy, FileUp, Loader2, Save, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { EstadoComite } from "@/app/admin/comites/actions";

type Accion = (prev: EstadoComite, fd: FormData) => Promise<EstadoComite>;
const INICIAL: EstadoComite = { error: null };
const campo = "h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring";

export const ZONAS = ["Zona Norte", "Zona Centro", "Zona Sur", "Sede Administrativa"];
export const ROLES = [
  { value: "PRINCIPAL_EMPLEADOR", label: "Representante principal del empleador" },
  { value: "SUPLENTE_EMPLEADOR", label: "Suplente del empleador" },
  { value: "PRINCIPAL_TRABAJADORES", label: "Representante principal de los trabajadores" },
  { value: "SUPLENTE_TRABAJADORES", label: "Suplente de los trabajadores" },
];

// ------------------------------------------------------------ nuevo comité

export function FormularioNuevoComite({ action }: { action: Accion }) {
  const [state, formAction, pendiente] = useActionState(action, INICIAL);
  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="title">Nombre del comité</Label>
        <Input id="title" name="title" placeholder="Ej. Comité de Convivencia Laboral" required />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="year">Año</Label>
          <Input id="year" name="year" type="number" defaultValue={new Date().getFullYear()} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="resolutionNumber">Resolución</Label>
          <Input id="resolutionNumber" name="resolutionNumber" placeholder="Ej. 084 de 2026" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="resolutionDate">Fecha de la resolución</Label>
          <Input id="resolutionDate" name="resolutionDate" type="date" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="periodLabel">Periodo de vigencia</Label>
        <Input id="periodLabel" name="periodLabel" placeholder="Ej. 2026-2028" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="summary">Resumen (información general)</Label>
        <textarea id="summary" name="summary" rows={5} className={cn(campo, "h-auto resize-y py-2.5")} placeholder="Objeto del comité, norma que lo conforma, alcance…" />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pendiente} className="gap-1.5 bg-gradient-to-r from-primary to-teal-400 text-white">
        {pendiente ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Crear comité
      </Button>
    </form>
  );
}

// ------------------------------------------------------------ información

export function FormularioInformacionComite({
  action,
  valores,
}: {
  action: Accion;
  valores: { title: string; resolutionNumber: string; resolutionDate: string; periodLabel: string; summary: string; functions: string };
}) {
  const [state, formAction, pendiente] = useActionState(action, INICIAL);
  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="title">Nombre</Label>
        <Input id="title" name="title" defaultValue={valores.title} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="resolutionNumber">Resolución</Label>
          <Input id="resolutionNumber" name="resolutionNumber" defaultValue={valores.resolutionNumber} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="resolutionDate">Fecha</Label>
          <Input id="resolutionDate" name="resolutionDate" type="date" defaultValue={valores.resolutionDate} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="periodLabel">Vigencia</Label>
          <Input id="periodLabel" name="periodLabel" defaultValue={valores.periodLabel} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="summary">Resumen</Label>
        <textarea id="summary" name="summary" rows={5} defaultValue={valores.summary} className={cn(campo, "h-auto resize-y py-2.5")} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="functions">Funciones y plazos</Label>
        <p className="text-[12px] text-muted-foreground">Una por línea. Separa el plazo con una barra: «Recibir y dar trámite a las quejas | 5 días calendario».</p>
        <textarea id="functions" name="functions" rows={10} defaultValue={valores.functions} className={cn(campo, "h-auto resize-y py-2.5 font-mono text-[12.5px]")} />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pendiente} size="sm" className="gap-1.5">
        {pendiente ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Guardar información
      </Button>
    </form>
  );
}

// ------------------------------------------------------------ documento

export function FormularioDocumentoComite({ action }: { action: Accion }) {
  const [state, formAction, pendiente] = useActionState(action, INICIAL);
  return (
    <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <input type="file" name="file" required className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-primary" />
      <Button type="submit" size="sm" disabled={pendiente} className="gap-1.5">
        {pendiente ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
        Adjuntar
      </Button>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}

// ------------------------------------------------------------ integrantes

export function FormularioIntegrante({ action }: { action: Accion }) {
  const [state, formAction, pendiente] = useActionState(action, INICIAL);
  return (
    <form action={formAction} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="documentNumber">Documento</Label>
          <Input id="documentNumber" name="documentNumber" inputMode="numeric" placeholder="Busca la cuenta por documento" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fullName">Nombre (si no tiene cuenta)</Label>
          <Input id="fullName" name="fullName" placeholder="Opcional" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="zone">Zona</Label>
          <select id="zone" name="zone" className={campo} defaultValue={ZONAS[0]}>
            {ZONAS.map((z) => (
              <option key={z} value={z}>{z}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="position">Cargo</Label>
          <Input id="position" name="position" placeholder="Ej. Auxiliar de enfermería" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="role">Rol en el comité</Label>
          <select id="role" name="role" className={campo} defaultValue={ROLES[0].value}>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" size="sm" disabled={pendiente} className="gap-1.5">
        {pendiente ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
        Agregar integrante
      </Button>
    </form>
  );
}

export function BotonQuitar({ onQuitar, etiqueta = "Quitar" }: { onQuitar: () => Promise<{ error: string | null }>; etiqueta?: string }) {
  const [pendiente, iniciar] = useTransition();
  return (
    <button
      type="button"
      disabled={pendiente}
      onClick={() => {
        if (!confirm("¿Quitar del comité?")) return;
        iniciar(async () => {
          const r = await onQuitar();
          if (r.error) toast.error(r.error);
        });
      }}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
      aria-label={etiqueta}
      title={etiqueta}
    >
      <Trash2 className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

// ------------------------------------------------------------ reuniones

export function FormularioReunion({ action }: { action: Accion }) {
  const [state, formAction, pendiente] = useActionState(action, INICIAL);
  const [modalidad, setModalidad] = useState("VIRTUAL");
  return (
    <form action={formAction} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="title">Reunión</Label>
        <Input id="title" name="title" placeholder="Ej. Reunión ordinaria · septiembre" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="date">Fecha</Label>
          <Input id="date" name="date" type="date" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="startTime">Inicio</Label>
          <Input id="startTime" name="startTime" type="time" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="endTime">Fin</Label>
          <Input id="endTime" name="endTime" type="time" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Modalidad</Label>
        <input type="hidden" name="modality" value={modalidad} />
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted/60 p-1">
          {[
            ["VIRTUAL", "Virtual"],
            ["PRESENCIAL", "Presencial"],
            ["MIXTA", "Mixta"],
          ].map(([v, l]) => (
            <button key={v} type="button" onClick={() => setModalidad(v)} className={cn("rounded-lg px-2 py-1.5 text-[12.5px] font-bold transition-all", modalidad === v ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              {l}
            </button>
          ))}
        </div>
      </div>
      {modalidad !== "VIRTUAL" && (
        <div className="space-y-1.5">
          <Label htmlFor="location">Lugar</Label>
          <Input id="location" name="location" placeholder="Ej. Sala de juntas, sede administrativa" />
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="objective">Orden del día (opcional)</Label>
        <textarea id="objective" name="objective" rows={3} className={cn(campo, "h-auto resize-y py-2")} />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pendiente} className="w-full gap-1.5 bg-gradient-to-r from-primary to-teal-400 text-white">
        {pendiente ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
        Convocar reunión
      </Button>
    </form>
  );
}

// ------------------------------------------------------------ enlace

export function BotonCopiar({ texto, etiqueta = "Copiar enlace" }: { texto: string; etiqueta?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(texto);
        setOk(true);
        setTimeout(() => setOk(false), 1800);
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/70 px-2.5 py-1.5 text-[12px] font-bold text-foreground transition-colors hover:border-primary/40"
    >
      {ok ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
      {ok ? "Copiado" : etiqueta}
    </button>
  );
}

// ------------------------------------------------------------ acción con confirmación

export function BotonAccionReunion({
  accion,
  etiqueta,
  confirmar,
  variante = "primaria",
}: {
  accion: () => Promise<{ error: string | null }>;
  etiqueta: string;
  confirmar?: string;
  variante?: "primaria" | "secundaria";
}) {
  const [pendiente, iniciar] = useTransition();
  return (
    <button
      type="button"
      disabled={pendiente}
      onClick={() => {
        if (confirmar && !confirm(confirmar)) return;
        iniciar(async () => {
          const r = await accion();
          if (r.error) toast.error(r.error);
          else toast.success("Listo");
        });
      }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[13px] font-bold transition-all disabled:opacity-60",
        variante === "primaria"
          ? "bg-gradient-to-r from-primary to-teal-400 text-white shadow-md shadow-primary/25"
          : "border border-border/60 bg-card/70 text-foreground hover:border-primary/40"
      )}
    >
      {pendiente ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
      {etiqueta}
    </button>
  );
}

// ------------------------------------------------------------ jornada faltante

export function FormularioJornadaReunion({ action }: { action: Accion }) {
  const [state, formAction, pendiente] = useActionState(action, INICIAL);
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="date">Fecha</Label>
        <Input id="date" name="date" type="date" required className="w-44" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="startTime">Inicio</Label>
        <Input id="startTime" name="startTime" type="time" required className="w-32" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="endTime">Fin (opcional)</Label>
        <Input id="endTime" name="endTime" type="time" className="w-32" />
      </div>
      <Button type="submit" disabled={pendiente} className="gap-1.5 bg-gradient-to-r from-primary to-teal-400 text-white">
        {pendiente ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
        Fijar fecha y hora
      </Button>
      {state.error && <p className="w-full text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
