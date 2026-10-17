"use client";

import { useActionState, useState, useTransition } from "react";
import { CalendarPlus, CheckCircle2, FileUp, Lock, LockOpen, Plus, Save, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EstadoReunion } from "@/app/admin/reuniones/actions";
import { CamposFichaDocumento } from "@/components/documentos/campos-ficha-documento";

const INICIAL: EstadoReunion = { error: null };
type Sesion = { fecha: string; inicio: string; fin: string; dirigidoA: string };
const VACIA: Sesion = { fecha: "", inicio: "", fin: "", dirigidoA: "" };

function Campo({ etiqueta, children, ayuda }: { etiqueta: string; children: React.ReactNode; ayuda?: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="block">{etiqueta}</span>
      {children}
      {ayuda && <span className="block text-[11.5px] font-normal normal-case tracking-normal text-muted-foreground">{ayuda}</span>}
    </label>
  );
}

/** Lista editable de sesiones (fecha, inicio, fin, dirigido a). */
function EditorSesiones({ sesiones, setSesiones }: { sesiones: Sesion[]; setSesiones: (s: Sesion[]) => void }) {
  const cambiar = (i: number, k: keyof Sesion, v: string) => setSesiones(sesiones.map((s, j) => (j === i ? { ...s, [k]: v } : s)));
  return (
    <div className="space-y-3">
      {sesiones.map((s, i) => (
        <div key={i} className="rounded-[14px] border border-border bg-[color-mix(in_oklch,var(--foreground)_2%,var(--card))] p-3.5">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-primary">Sesión {i + 1}</span>
            {sesiones.length > 1 && (
              <button
                type="button"
                onClick={() => setSesiones(sesiones.filter((_, j) => j !== i))}
                className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                aria-label={`Quitar sesión ${i + 1}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <Campo etiqueta="Fecha">
              <input type="date" required value={s.fecha} onChange={(e) => cambiar(i, "fecha", e.target.value)} className="w-full" />
            </Campo>
            <Campo etiqueta="Inicio">
              <input type="time" required value={s.inicio} onChange={(e) => cambiar(i, "inicio", e.target.value)} className="w-full" />
            </Campo>
            <Campo etiqueta="Fin">
              <input type="time" value={s.fin} onChange={(e) => cambiar(i, "fin", e.target.value)} className="w-full" />
            </Campo>
          </div>
          <div className="mt-2.5">
            <Campo etiqueta="Dirigida a / zonas">
              <input value={s.dirigidoA} onChange={(e) => cambiar(i, "dirigidoA", e.target.value)} placeholder="Ej. Zona Sur y Zona Centro" className="w-full" />
            </Campo>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setSesiones([...sesiones, { ...VACIA, fecha: sesiones[sesiones.length - 1]?.fecha ?? "" }])}
        className="inline-flex items-center gap-1.5 rounded-[10px] border border-dashed border-primary/45 px-3 py-2 text-[12.5px] font-semibold text-primary hover:bg-primary/6"
      >
        <CalendarPlus className="h-4 w-4" /> Agregar otra sesión
      </button>
    </div>
  );
}

export function FormularioReunion({
  action,
  anfitriones,
}: {
  action: (s: EstadoReunion, fd: FormData) => Promise<EstadoReunion>;
  anfitriones: { id: string; nombre: string }[];
}) {
  const [state, formAction, pendiente] = useActionState(action, INICIAL);
  const [sesiones, setSesiones] = useState<Sesion[]>([{ ...VACIA }]);
  return (
    <form action={formAction} className="space-y-4">
      <Campo etiqueta="Nombre de la reunión">
        <input name="titulo" required placeholder="Ej. Sistema Global Armonizado" className="w-full" />
      </Campo>
      <Campo etiqueta="Objetivo" ayuda="Aparece en el acta como objetivo general.">
        <textarea name="objetivo" rows={2} className="w-full" placeholder="¿Para qué se convoca la reunión?" />
      </Campo>
      <Campo etiqueta="Orden del día" ayuda="Un punto por línea.">
        <textarea name="ordenDelDia" rows={3} className="w-full" placeholder={"1. Saludo y verificación de asistencia\n2. …"} />
      </Campo>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Campo etiqueta="Responsable (como figura en el acta)">
          <input name="responsable" placeholder="Ej. SST y ARL Positiva" className="w-full" />
        </Campo>
        <Campo etiqueta="Anfitrión en la plataforma">
          <select name="anfitrionId" className="w-full" defaultValue="">
            <option value="">Yo</option>
            {anfitriones.map((a) => (
              <option key={a.id} value={a.id}>{a.nombre}</option>
            ))}
          </select>
        </Campo>
      </div>
      <div className="space-y-2">
        <span className="block">Sesiones</span>
        <EditorSesiones sesiones={sesiones} setSesiones={setSesiones} />
      </div>
      <input type="hidden" name="sesiones" value={JSON.stringify(sesiones)} />
      {state.error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pendiente} className="w-full gap-1.5">
        <Plus className="h-4 w-4" />
        {pendiente ? "Creando…" : "Crear reunión con sus enlaces y QR"}
      </Button>
      <p className="text-center text-[11.5px] text-muted-foreground">
        Cada sesión queda abierta con su enlace de registro (nombre y cargo), su QR y su sala virtual.
      </p>
    </form>
  );
}

export function FormularioAgregarSesion({ action }: { action: (s: EstadoReunion, fd: FormData) => Promise<EstadoReunion> }) {
  const [state, formAction, pendiente] = useActionState(action, INICIAL);
  const [sesiones, setSesiones] = useState<Sesion[]>([{ ...VACIA }]);
  return (
    <form action={formAction} className="space-y-4">
      <EditorSesiones sesiones={sesiones} setSesiones={setSesiones} />
      <input type="hidden" name="sesiones" value={JSON.stringify(sesiones)} />
      {state.error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>}
      {state.ok && <p className="flex items-center gap-1.5 text-sm font-semibold text-success"><CheckCircle2 className="h-4 w-4" /> Sesión agregada.</p>}
      <Button type="submit" disabled={pendiente} className="w-full gap-1.5">
        <CalendarPlus className="h-4 w-4" />
        {pendiente ? "Agregando…" : "Agregar sesión"}
      </Button>
    </form>
  );
}

export function FormularioActa({
  action,
  valores,
  bloqueado,
}: {
  action: (s: EstadoReunion, fd: FormData) => Promise<EstadoReunion>;
  valores: { objetivo: string; desarrollo: string; compromisos: string; ordenDelDia: string };
  bloqueado: boolean;
}) {
  const [state, formAction, pendiente] = useActionState(action, INICIAL);
  return (
    <form action={formAction} className="space-y-4">
      <fieldset disabled={bloqueado} className="space-y-4 disabled:opacity-80">
        <Campo etiqueta="Objetivo de la sesión">
          <textarea name="objetivo" rows={2} defaultValue={valores.objetivo} className="w-full" />
        </Campo>
        <Campo etiqueta="Orden del día de la reunión" ayuda="Un punto por línea. Es el mismo para todas las sesiones.">
          <textarea name="ordenDelDia" rows={3} defaultValue={valores.ordenDelDia} className="w-full" />
        </Campo>
        <Campo etiqueta="Desarrollo · temas tratados">
          <textarea name="desarrollo" rows={6} defaultValue={valores.desarrollo} className="w-full" placeholder="Resumen de lo tratado en la sesión…" />
        </Campo>
        <Campo etiqueta="Compromisos" ayuda="Uno por línea. Ej.: Socializar el SGA en cada IPS — Responsable: SST — 30/10/2026">
          <textarea name="compromisos" rows={4} defaultValue={valores.compromisos} className="w-full" />
        </Campo>
      </fieldset>
      {state.error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>}
      {state.ok && <p className="flex items-center gap-1.5 text-sm font-semibold text-success"><CheckCircle2 className="h-4 w-4" /> Contenido del acta guardado.</p>}
      {!bloqueado && (
        <Button type="submit" disabled={pendiente} className="gap-1.5">
          <Save className="h-4 w-4" />
          {pendiente ? "Guardando…" : "Guardar contenido del acta"}
        </Button>
      )}
    </form>
  );
}

export function SubirActaFirmada({ action }: { action: (s: EstadoReunion, fd: FormData) => Promise<EstadoReunion> }) {
  const [state, formAction, pendiente] = useActionState(action, INICIAL);
  return (
    <form action={formAction} className="space-y-3">
      <CamposFichaDocumento contexto="reunion" tipoFijo="ACTA" />
      <input type="file" name="file" accept=".pdf,image/*,.doc,.docx" required className="w-full text-sm" />
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.ok && <p className="flex items-center gap-1.5 text-sm font-semibold text-success"><CheckCircle2 className="h-4 w-4" /> Acta firmada archivada.</p>}
      <Button type="submit" variant="outline" disabled={pendiente} className="w-full gap-1.5">
        <FileUp className="h-4 w-4" />
        {pendiente ? "Subiendo…" : "Subir acta firmada"}
      </Button>
    </form>
  );
}

/** Cerrar / reabrir / eliminar la sesión, con confirmación. */
export function AccionesSesion({
  estado,
  esAdmin,
  onCerrar,
  onReabrir,
  onEliminar,
}: {
  estado: "DRAFT" | "OPEN" | "CLOSED";
  esAdmin: boolean;
  onCerrar: () => Promise<EstadoReunion>;
  onReabrir: () => Promise<EstadoReunion>;
  onEliminar: () => Promise<EstadoReunion>;
}) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const correr = (fn: () => Promise<EstadoReunion>, aviso: string) => {
    if (!window.confirm(aviso)) return;
    setError(null);
    iniciar(async () => {
      const r = await fn();
      if (r.error) setError(r.error);
    });
  };
  return (
    <div className="flex flex-wrap items-center gap-2" data-escritura>
      {estado !== "CLOSED" ? (
        <Button type="button" size="sm" variant="outline" disabled={pendiente} className="gap-1.5" onClick={() => correr(onCerrar, "¿Cerrar la sesión? La asistencia queda congelada y el enlace deja de aceptar registros.")}>
          <Lock className="h-3.5 w-3.5" /> Cerrar sesión
        </Button>
      ) : (
        esAdmin && (
          <Button type="button" size="sm" variant="outline" disabled={pendiente} className="gap-1.5" onClick={() => correr(onReabrir, "¿Reabrir la sesión? Volverá a aceptar registros. Queda en la bitácora.")}>
            <LockOpen className="h-3.5 w-3.5" /> Reabrir
          </Button>
        )
      )}
      <Button type="button" size="sm" variant="ghost" disabled={pendiente} className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => correr(onEliminar, "¿Eliminar esta sesión? Solo es posible si nadie se ha registrado.")}>
        <Trash2 className="h-3.5 w-3.5" /> Eliminar
      </Button>
      {error && <p className="w-full text-[12.5px] text-destructive">{error}</p>}
    </div>
  );
}
