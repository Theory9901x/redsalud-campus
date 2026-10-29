"use client";
import { useCallback, useEffect, useState } from "react";
import { Check, FileDown, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import type { ContenidoReunion } from "@/lib/reunion-contenido";
import { nombreLegibleDocumento } from "@/lib/documentos";
import { gestionarCompromisoReunionAction, guardarDesarrolloReunionAction } from "@/app/admin/reuniones/gestion-actions";
import type { EstadoReunion } from "@/app/admin/reuniones/actions";

const control = "w-full rounded-lg border border-input bg-background px-3 py-2.5 text-base leading-relaxed disabled:opacity-60";
const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-base font-semibold text-primary-foreground disabled:opacity-50";
const outline = "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold disabled:opacity-50";

/** Lo que necesita el anfitrión para ir llenando el acta sin salir de la llamada. */
type Anfitrion = { planId: string; desarrollo: string };

export function ContenidoSalaReunion({ activityId, inicial, anfitrion }: { activityId: string; inicial: ContenidoReunion; anfitrion?: Anfitrion }) {
  const [data, setData] = useState(inicial);
  const [pending, setPending] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; error: boolean } | null>(null);
  const [nuevo, setNuevo] = useState("");
  const [edicion, setEdicion] = useState<{ indice: number; texto: string; originales: string[] } | null>(null);
  const load = useCallback(async () => {
    const r = await fetch(`/api/reuniones/sala/${activityId}/contenido`, { cache: "no-store" });
    if (r.ok) setData(await r.json());
  }, [activityId]);
  useEffect(() => {
    const timer = setInterval(() => { if (document.visibilityState === "visible") void load().catch(() => {}); }, 15000);
    return () => clearInterval(timer);
  }, [load]);

  const editable = !!anfitrion && !data.cerrada;
  const bloqueado = !editable || pending;
  async function ejecutar(action: () => Promise<EstadoReunion>, mensaje: string, listo?: () => void) {
    setPending(true); setAviso(null);
    try {
      const result = await action();
      await load().catch(() => {});
      if (result.error) { setAviso({ texto: result.error, error: true }); return; }
      listo?.(); setAviso({ texto: mensaje, error: false });
    } catch { setAviso({ texto: "No se pudo confirmar el cambio. Revisa la lista antes de repetirlo.", error: true }); }
    finally { setPending(false); }
  }
  const compromiso = (operacion: "agregar" | "editar" | "eliminar", campos: Record<string, string>) => {
    const fd = new FormData(); fd.set("operacion", operacion);
    for (const [k, v] of Object.entries(campos)) fd.set(k, v);
    return () => gestionarCompromisoReunionAction(anfitrion!.planId, activityId, fd);
  };
  const agregar = () => { if (nuevo.trim()) void ejecutar(compromiso("agregar", { texto: nuevo }), "Compromiso agregado al acta.", () => setNuevo("")); };

  return <div id="contenido-reunion" className="grid gap-4 md:grid-cols-2">
    <section className="space-y-4 rounded-xl border bg-card p-5">
      <div><h2 className="text-xl font-semibold">Compromisos de la reunión ({data.compromisos.length})</h2>
        <p className="text-base text-muted-foreground">{editable ? "Agrega cada acuerdo como un ítem aparte; queda en el acta al instante." : data.cerrada ? "La reunión está cerrada; los compromisos quedaron en el acta." : "Los registra el anfitrión durante la reunión."}</p></div>
      {aviso && <p role={aviso.error ? "alert" : "status"} className={`rounded-lg p-3 text-sm ${aviso.error ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}>{aviso.texto}</p>}
      <ol className="space-y-2">{data.compromisos.map((text, i) => <li key={`${i}-${text}`} className="rounded-lg border bg-background/60 p-3">
        {edicion?.indice === i ? <form className="space-y-2" onSubmit={e => { e.preventDefault(); void ejecutar(compromiso("editar", { texto: edicion.texto, indice: String(i), originales: JSON.stringify(edicion.originales) }), "Compromiso actualizado.", () => setEdicion(null)); }}>
          <label htmlFor={`editar-compromiso-${i}`} className="sr-only">Editar compromiso {i + 1}</label>
          <textarea id={`editar-compromiso-${i}`} required rows={3} autoFocus disabled={bloqueado} className={control} value={edicion.texto} onChange={e => setEdicion({ ...edicion, texto: e.target.value })} />
          <div className="flex gap-2"><button className={outline} disabled={bloqueado || !edicion.texto.trim()}><Check className="h-4 w-4" />Guardar</button><button type="button" className={outline} onClick={() => setEdicion(null)}><X className="h-4 w-4" />Cancelar</button></div>
        </form> : <div className="flex items-start gap-3">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">{i + 1}</span>
          <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-base leading-relaxed">{text}</p>
          {editable && <div className="flex shrink-0 gap-1">
            <button type="button" disabled={bloqueado} className={outline} aria-label={`Editar compromiso ${i + 1}`} onClick={() => setEdicion({ indice: i, texto: text, originales: [...data.compromisos] })}><Pencil className="h-4 w-4" /></button>
            <button type="button" disabled={bloqueado} className={`${outline} text-destructive`} aria-label={`Eliminar compromiso ${i + 1}`} onClick={() => { if (window.confirm("¿Eliminar este compromiso del acta?")) void ejecutar(compromiso("eliminar", { indice: String(i), originales: JSON.stringify(data.compromisos) }), "Compromiso eliminado."); }}><Trash2 className="h-4 w-4" /></button>
          </div>}
        </div>}
      </li>)}</ol>
      {!data.compromisos.length && <p className="text-base text-muted-foreground">Todavía no hay compromisos registrados.</p>}
      {editable && <form className="space-y-2 border-t pt-4" onSubmit={e => { e.preventDefault(); agregar(); }}>
        <label htmlFor={`nuevo-compromiso-sala-${activityId}`} className="block font-semibold">Nuevo compromiso</label>
        <textarea id={`nuevo-compromiso-sala-${activityId}`} rows={3} disabled={bloqueado} value={nuevo} onChange={e => setNuevo(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); agregar(); } }} className={control} placeholder="Ej.: Socializar el procedimiento actualizado. Responsable: Calidad. Fecha: 30/10/2026." />
        <button disabled={bloqueado || !nuevo.trim()} className={`${button} w-full`}><Plus className="h-5 w-5" />{pending ? "Guardando…" : "Agregar compromiso"}</button>
        <p className="text-xs text-muted-foreground">Ctrl + Enter también lo agrega.</p>
      </form>}
    </section>
    <div className="space-y-4">
      {editable && anfitrion && <section className="space-y-3 rounded-xl border bg-card p-5">
        <h2 className="text-xl font-semibold">Desarrollo del acta</h2>
        <form className="space-y-2" onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); void ejecutar(() => guardarDesarrolloReunionAction(anfitrion.planId, activityId, fd), "Desarrollo guardado en el acta."); }}>
          <label htmlFor={`desarrollo-sala-${activityId}`} className="text-base text-muted-foreground">Temas tratados y conclusiones. Guarda cada tanto mientras avanza la reunión.</label>
          <textarea id={`desarrollo-sala-${activityId}`} name="desarrollo" rows={8} defaultValue={anfitrion.desarrollo} disabled={bloqueado} className={control} />
          <button disabled={bloqueado} className={button}><Save className="h-4 w-4" />Guardar desarrollo</button>
        </form>
      </section>}
      <section className="space-y-4 rounded-xl border bg-card p-5"><h2 className="text-xl font-semibold">Documentos asociados</h2>{data.documentos.map(doc => <article key={doc.id} className="space-y-2 rounded-lg border p-3"><p className="break-words text-base font-semibold">{nombreLegibleDocumento(doc.fileName)}</p>{doc.description && <p className="text-sm text-muted-foreground">{doc.description}</p>}<div className="flex gap-3"><a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="text-base font-semibold text-primary underline">Ver documento</a><a href={`${doc.fileUrl}?download=1`} download className="inline-flex items-center gap-2 text-base font-semibold text-primary underline"><FileDown className="h-4 w-4" />Descargar</a></div></article>)}{!data.documentos.length && <p className="text-base text-muted-foreground">No hay documentos asociados todavía.</p>}</section>
    </div>
  </div>;
}
