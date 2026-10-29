"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ClipboardList, FileDown, Paperclip, Pencil, Plus, Save, Settings2, Trash2, Users2 } from "lucide-react";
import type { GestionReunion } from "@/lib/reuniones-gestion";
import { editarDatosReunionAction, gestionarCompromisoReunionAction, adjuntarDocumentoReunionAction, guardarDesarrolloReunionAction } from "@/app/admin/reuniones/gestion-actions";
import { cerrarSesionAction, reabrirSesionAction, type EstadoReunion } from "@/app/admin/reuniones/actions";
import { TIPOS_DOCUMENTO, nombreLegibleDocumento } from "@/lib/documentos";

type Areas = { id: string; name: string }[];
const control = "w-full rounded-lg border border-input bg-background px-3 py-3 text-base disabled:opacity-60";
const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-base font-semibold text-primary-foreground disabled:opacity-50";
const outline = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50";

export function GestionReunionEnVivo({ inicial, areas, formularioActaFirmada, editarInicial = false }: { inicial: GestionReunion; areas: Areas; formularioActaFirmada?: React.ReactNode; editarInicial?: boolean }) {
  const [editando, setEditando] = useState(editarInicial);
  const [d, setDatos] = useState(inicial);
  const [pending, setPending] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; error: boolean } | null>(null);
  const [edicion, setEdicion] = useState<{ indice: number; texto: string; originales: string[] } | null>(null);
  const base = `/api/reuniones/${d.planId}/sesiones/${d.activityId}`;
  const actualizar = useCallback(async () => {
    const r = await fetch(`/api/reuniones/${inicial.planId}/sesiones/${inicial.activityId}/gestion`, { cache: "no-store" });
    if (!r.ok) throw new Error("No se pudo actualizar la sesión. Verifica tu acceso.");
    const next: GestionReunion = await r.json(); setDatos(next);
    window.dispatchEvent(new CustomEvent("reunion:estado", { detail: { activityId: next.activityId, cerrada: next.cerrada } }));
  }, [inicial.planId, inicial.activityId]);
  useEffect(() => {
    const timer = setInterval(() => { if (document.visibilityState === "visible") void actualizar().catch(() => {}); }, 15000);
    return () => clearInterval(timer);
  }, [actualizar]);

  async function ejecutar(action: () => Promise<EstadoReunion>, mensaje: string, listo?: () => void) {
    setPending(true); setAviso(null);
    try {
      const result = await action();
      if (result.error) { setAviso({ texto: result.error, error: true }); await actualizar(); return; }
      await actualizar(); listo?.(); setAviso({ texto: mensaje, error: false });
    } catch { setAviso({ texto: "No se pudo confirmar el cambio. Actualiza la sesión para comprobar lo guardado antes de repetirlo.", error: true }); }
    finally { setPending(false); }
  }
  const bloqueado = !d.puedeGestionar || d.cerrada || pending;
  const tabs = [{ id: "compromisos", name: "Compromisos", Icon: ClipboardList }, { id: "documentos", name: "Documentos", Icon: Paperclip }, { id: "asistencia", name: `Asistencia (${d.asistentes.length})`, Icon: Users2 }, { id: "datos", name: "Datos de la reunión", Icon: Settings2 }, { id: "desarrollo", name: "Acta", Icon: Pencil }];
  return <section id="gestion-reunion" className="scroll-mt-6 overflow-hidden rounded-2xl border bg-card text-foreground shadow-sm">
    <header className="space-y-3 border-b bg-primary/5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">{editando ? "Editar reunión" : "Información de la reunión"}</h2>{d.puedeGestionar && <button type="button" disabled={pending || d.cerrada} className={button} onClick={() => { setEditando(!editando); setEdicion(null); setAviso(null); }}><Pencil className="h-4 w-4" />{editando ? "Volver a consulta" : "Editar"}</button>}</div>
      <p className="text-base leading-relaxed text-muted-foreground">{editando ? "Guarda los cambios de cada sección antes de volver a consulta." : "Consulta los datos, la asistencia, el acta y los documentos de esta sesión."}</p>
      <p className="text-sm font-medium">La hora de fin es orientativa. La reunión permanece abierta hasta que su creador o anfitrión pulse Cerrar reunión.</p>
      <div className="flex flex-wrap gap-2">
        <a className={outline} href={`${base}/acta`}><FileDown className="h-4 w-4" />Acta PDF</a>
        <a className={outline} href={`${base}/asistencia/excel`}>Asistencia Excel</a>
        <a className={outline} href={`${base}/asistencia/pdf`}>Asistencia PDF</a>
        {d.puedeGestionar && <button type="button" disabled={pending} className={outline} onClick={() => {
          if (!d.cerrada && !window.confirm("¿Estás seguro de cerrar la reunión?")) return;
          void ejecutar(() => d.cerrada ? reabrirSesionAction(d.planId, d.activityId) : cerrarSesionAction(d.planId, d.activityId), d.cerrada ? "Reunión reabierta." : "Reunión cerrada manualmente.", () => { setEditando(false); setEdicion(null); });
        }}>{d.cerrada ? "Reabrir reunión" : "Cerrar reunión"}</button>}
      </div>
      {d.cerrada && <p className="rounded-lg border bg-background p-3 text-sm">La sesión fue cerrada manualmente. Puedes consultar y descargar su información; para editarla, pulsa Reabrir reunión.</p>}
    </header>
    <nav aria-label="Submódulos de la reunión" className="flex flex-wrap gap-2 border-b p-3">{tabs.map(t => <a key={t.id} href={`#modulo-${t.id}`} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-muted px-3 py-2 text-base font-semibold"><t.Icon className="h-4 w-4" />{t.name}</a>)}</nav>
    <div className="space-y-5 p-5">
      {aviso && <p role={aviso.error ? "alert" : "status"} className={`rounded-lg p-3 text-base ${aviso.error ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}>{aviso.texto}</p>}
      <section id="modulo-compromisos" className="space-y-5 rounded-xl border p-5">
        <h3 className="text-xl font-semibold">Compromisos</h3>
        {editando && (<form onSubmit={e => { e.preventDefault(); const form = e.currentTarget; const fd = new FormData(form); fd.set("operacion", "agregar"); void ejecutar(() => gestionarCompromisoReunionAction(d.planId, d.activityId, fd), "Compromiso guardado en el acta.", () => form.reset()); }} className="space-y-3">
          <label htmlFor={`nuevo-compromiso-${d.activityId}`} className="block text-2xl font-semibold">Añadir compromisos</label>
          <p className="text-base text-muted-foreground">Escribe el acuerdo, su responsable y la fecha de cumplimiento mientras continúa la reunión.</p>
          <textarea id={`nuevo-compromiso-${d.activityId}`} name="texto" required rows={7} disabled={bloqueado} className={`${control} min-h-48 leading-relaxed`} placeholder="Ej.: Socializar el procedimiento actualizado. Responsable: área de Calidad. Fecha de cumplimiento: 30/10/2026." />
          <button type="submit" disabled={bloqueado} className={`${button} w-full`}><Plus className="h-5 w-5" />{pending ? "Guardando…" : "Guardar compromiso en el acta"}</button>
        </form>)}
        <div className="space-y-3"><h3 className="text-lg font-semibold">Compromisos guardados ({d.compromisos.length})</h3>{d.compromisos.map((text, i) => <article key={`${i}-${text}`} className="space-y-3 rounded-lg border p-4"><p className="whitespace-pre-wrap text-base leading-relaxed"><span className="font-semibold">{i + 1}. </span>{text}</p>{editando && d.puedeGestionar && <div className="flex flex-wrap gap-2"><button type="button" disabled={bloqueado} className={outline} onClick={() => setEdicion({ indice: i, texto: text, originales: [...d.compromisos] })}><Pencil className="h-4 w-4" />Editar</button><button type="button" disabled={bloqueado} className={`${outline} text-destructive`} onClick={() => { if (!window.confirm("¿Eliminar este compromiso del acta?")) return; const fd = new FormData(); fd.set("operacion", "eliminar"); fd.set("indice", String(i)); fd.set("originales", JSON.stringify(d.compromisos)); void ejecutar(() => gestionarCompromisoReunionAction(d.planId, d.activityId, fd), "Compromiso eliminado."); }}><Trash2 className="h-4 w-4" />Eliminar</button></div>}</article>)}{!d.compromisos.length && <p className="text-base text-muted-foreground">Todavía no hay compromisos guardados.</p>}</div>
        {editando && edicion && <form className="space-y-3 rounded-lg border-2 border-primary p-4" onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); fd.set("operacion", "editar"); fd.set("indice", String(edicion.indice)); fd.set("originales", JSON.stringify(edicion.originales)); void ejecutar(() => gestionarCompromisoReunionAction(d.planId, d.activityId, fd), "Compromiso actualizado.", () => setEdicion(null)); }}><label className="block font-semibold" htmlFor="editar-compromiso">Editar compromiso</label><textarea id="editar-compromiso" name="texto" required rows={5} className={control} value={edicion.texto} onChange={e => setEdicion({ ...edicion, texto: e.target.value })} /><div className="flex gap-2"><button className={button} disabled={bloqueado}>Guardar cambios</button><button type="button" className={outline} onClick={() => setEdicion(null)}>Cancelar</button></div></form>}
      </section>
      <section id="modulo-documentos" className="space-y-5 rounded-xl border p-5">
        <h3 className="text-xl font-semibold">Documentos de la reunión</h3>
        {editando && d.puedeGestionar && <form className="space-y-3" onSubmit={e => { e.preventDefault(); const form = e.currentTarget; const fd = new FormData(form); void ejecutar(() => adjuntarDocumentoReunionAction(d.planId, d.activityId, fd), "Documento adjuntado a la sesión.", () => form.reset()); }}>
          <label className="block space-y-2"><span className="font-semibold">Tipo de documento</span><select name="kind" className={control} defaultValue="MATERIAL">{Object.entries(TIPOS_DOCUMENTO).map(([k, name]) => <option key={k} value={k}>{name}</option>)}</select></label>
          <label className="block space-y-2"><span className="font-semibold">Descripción</span><input name="description" maxLength={200} className={control} placeholder="¿Qué contiene este archivo?" /></label>
          <label className="block space-y-2"><span className="font-semibold">Archivo (hasta 15 MB)</span><input name="file" type="file" required onChange={e => e.currentTarget.setCustomValidity((e.currentTarget.files?.[0]?.size ?? 0) > 15 * 1024 * 1024 ? "El archivo debe pesar hasta 15 MB." : "")} accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.webp,.txt,.csv" className={control} /></label>
          <button disabled={pending} className={button}><Paperclip className="h-4 w-4" />{pending ? "Adjuntando…" : "Adjuntar documento"}</button>
        </form>}
        <div className="space-y-3">{d.documentos.map(doc => <article key={doc.id} className="space-y-2 rounded-lg border p-4"><a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="break-words text-base font-semibold text-primary underline">{nombreLegibleDocumento(doc.fileName)}</a><p className="text-sm text-muted-foreground">{doc.description || "Sin descripción"}</p><p className="text-sm text-muted-foreground">{doc.fecha} · {doc.uploader}</p><a className={outline} href={`${doc.fileUrl}?download=1`} download>Descargar archivo</a></article>)}{!d.documentos.length && <p className="text-muted-foreground">No hay documentos adjuntos.</p>}</div>
      </section>
      <section id="modulo-asistencia" className="space-y-5 rounded-xl border p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-xl font-semibold">Asistencia automática ({d.asistentes.length})</h3><a href={`${base}/asistencia/excel`} className={outline}>Descargar Excel</a><a href={`${base}/asistencia/pdf`} className={button}>Descargar PDF</a><button type="button" className={outline} onClick={() => void actualizar().catch(() => setAviso({ texto: "No se pudo actualizar la asistencia.", error: true }))}>Actualizar asistencia</button></div>
        <p className="text-base text-muted-foreground">Se actualiza cada 15 segundos. Una fila por persona que ingresó realmente a la sala.</p>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{["Nombre", "Cargo", "Ingreso", "Salida / estado", "Minutos", "Ingresos"].map(t => <th key={t} className="border-b p-3 font-semibold">{t}</th>)}</tr></thead><tbody>{d.asistentes.map(a => <tr key={a.clave}><td className="border-b p-3 font-semibold">{a.nombre}</td><td className="border-b p-3">{a.cargo}</td><td className="border-b p-3">{a.ingreso}</td><td className="border-b p-3">{a.salida}</td><td className="border-b p-3">{a.minutos}</td><td className="border-b p-3">{a.conexiones}</td></tr>)}</tbody></table></div>
        {!d.asistentes.length && <p className="text-muted-foreground">Nadie ha ingresado todavía.</p>}
        <a className={button} href={`${base}/asistencia/pdf`}>Descargar asistencia e informe PDF</a>
      </section>
      <section id="modulo-desarrollo" className="space-y-5 rounded-xl border p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-2xl font-semibold">Acta de la reunión</h3><a href={`${base}/acta`} className={button}><FileDown className="h-4 w-4" />Descargar acta PDF</a></div><div className="space-y-4 rounded-lg bg-muted/40 p-4"><p className="text-lg font-semibold">{d.reunion}</p><p>Responsable: {d.responsable}</p><section><h4 className="font-semibold">Objetivo</h4><p className="whitespace-pre-wrap leading-relaxed">{d.objetivo || "Sin objetivo registrado."}</p></section><section><h4 className="font-semibold">Orden del día</h4><p className="whitespace-pre-wrap leading-relaxed">{d.ordenDelDia || "Sin puntos registrados."}</p></section><section><h4 className="font-semibold">Desarrollo de la reunión</h4><p className="whitespace-pre-wrap leading-relaxed">{d.desarrollo || "Sin desarrollo registrado."}</p></section><section><h4 className="font-semibold">Compromisos y acuerdos</h4><ol className="list-inside list-decimal space-y-2">{d.compromisos.map((text,i)=><li key={i} className="whitespace-pre-wrap">{text}</li>)}</ol></section><p>Asistencia: {d.asistentes.length} personas con ingreso registrado. La tabla completa se incluye en el PDF.</p></div>{editando && <form className="space-y-4" onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); void ejecutar(() => guardarDesarrolloReunionAction(d.planId, d.activityId, fd), "Desarrollo guardado en el acta."); }}><h3 className="text-xl font-semibold">Desarrollo de la reunión</h3><p className="text-base text-muted-foreground">Registra los temas tratados y las conclusiones. Los compromisos se guardan en su sección.</p><textarea name="desarrollo" aria-label="Desarrollo de la reunión" defaultValue={d.desarrollo} rows={12} disabled={bloqueado} className={control} /><button className={button} disabled={bloqueado}><Save className="h-4 w-4" />Guardar desarrollo en el acta</button></form>}</section>
      <section id="modulo-datos" className="space-y-5 rounded-xl border p-5">{editando ? <DatosSesion d={d} areas={areas} disabled={bloqueado} onGuardar={(fd) => ejecutar(() => editarDatosReunionAction(d.planId, d.activityId, fd), "Datos de la sesión actualizados. Los enlaces se conservaron.")} /> : <ResumenDatos d={d} areas={areas} />}</section>
      <section id="acta-firmada" className="space-y-4 rounded-xl border p-5"><h3 className="text-xl font-semibold">Acta firmada</h3>{d.documentos.filter(doc => doc.kind === "ACTA" || doc.fileName.toUpperCase().includes("ACTA")).map(doc => <a key={doc.id} className={outline} href={`${doc.fileUrl}?download=1`} download><FileDown className="h-4 w-4" />Descargar {nombreLegibleDocumento(doc.fileName)}</a>)}{!d.documentos.some(doc => doc.kind === "ACTA" || doc.fileName.toUpperCase().includes("ACTA")) && <p className="text-base text-muted-foreground">No hay acta firmada adjunta.</p>}{editando && d.puedeGestionar && formularioActaFirmada && <div className="form-premium max-w-3xl">{formularioActaFirmada}</div>}</section>
      {pending && <p role="status" className="text-sm text-muted-foreground">Guardando cambios…</p>}
    </div>
  </section>;
}

function ResumenDatos({ d, areas }: { d: GestionReunion; areas: Areas }) {
  const datos = [
    ["Reunión", d.reunion], ["Sesión", d.titulo], ["Fecha", d.fecha ? d.fecha.split("-").reverse().join("/") : "Sin fecha"],
    ["Horario previsto", `${d.inicio || "Sin hora"}${d.fin ? ` – ${d.fin}` : ""}`],
    ["Responsable", d.responsable], ["Área anfitriona", areas.find(a => a.id === d.anfitrionAreaId)?.name || "Sin área asignada"],
    ["Participantes", d.audience === "INTERNAL" ? "Internos" : d.audience === "EXTERNAL" ? "Externos" : "Internos y externos"],
    ["Modalidad", d.modalidad === "VIRTUAL" ? "Virtual" : d.modalidad === "PRESENCIAL" ? "Presencial" : "Mixta"],
    ["Dirigida a / zonas", d.dirigidoA || "Sin información registrada"], ["Lugar / sala", d.lugar || "Sin lugar registrado"],
  ];
  return <><h3 className="text-xl font-semibold">Datos de la reunión</h3><dl className="grid gap-4 sm:grid-cols-2">{datos.map(([label, value]) => <div key={label} className="min-w-0 border-b pb-3"><dt className="text-sm font-semibold text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-base">{value}</dd></div>)}</dl></>;
}

function DatosSesion({ d, areas, disabled, onGuardar }: { d: GestionReunion; areas: Areas; disabled: boolean; onGuardar: (fd: FormData) => Promise<void> }) {
  return <form className="space-y-4" onSubmit={e => { e.preventDefault(); void onGuardar(new FormData(e.currentTarget)); }}>
    <h3 className="text-xl font-semibold">Editar datos y horario</h3>
    <fieldset disabled={disabled} className="space-y-4">
      <label className="block space-y-2"><span className="font-semibold">Nombre de la reunión</span><input name="reunion" required minLength={4} defaultValue={d.reunion} readOnly={!d.puedeEditarReunion} className={control} /></label>
      <label className="block space-y-2"><span className="font-semibold">Nombre de esta sesión</span><input name="titulo" required minLength={4} defaultValue={d.titulo} className={control} /></label>
      <label className="block space-y-2"><span className="font-semibold">Objetivo</span><textarea name="objetivo" rows={4} defaultValue={d.objetivo} className={control} /></label>
      <label className="block space-y-2"><span className="font-semibold">Orden del día de esta sesión</span><textarea name="ordenDelDia" rows={5} defaultValue={d.ordenDelDia} className={control} /></label>
      <label className="block space-y-2"><span className="font-semibold">Responsable (como figura en el acta)</span><input name="responsable" required defaultValue={d.responsable} className={control} /></label>
      <label className="block space-y-2"><span className="font-semibold">Área anfitriona</span><select name="anfitrionAreaId" defaultValue={d.anfitrionAreaId} disabled={!d.puedeEditarReunion} className={control}><option value="" disabled>Selecciona el área</option>{areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>{!d.puedeEditarReunion && <input type="hidden" name="anfitrionAreaId" value={d.anfitrionAreaId} />}</label>
      <div className="grid gap-4 sm:grid-cols-3"><label className="space-y-2"><span className="block font-semibold">Fecha</span><input name="fecha" type="date" required defaultValue={d.fecha} className={control} /></label><label className="space-y-2"><span className="block font-semibold">Inicio</span><input name="inicio" type="time" required defaultValue={d.inicio} className={control} /></label><label className="space-y-2"><span className="block font-semibold">Fin previsto</span><input name="fin" type="time" defaultValue={d.fin} className={control} /></label></div>
      <p className="text-sm text-muted-foreground">El fin previsto no cierra la sala. Solo el creador o el anfitrión pueden cerrarla manualmente.</p>
      <label className="block space-y-2"><span className="font-semibold">Dirigida a / zonas</span><input name="dirigidoA" defaultValue={d.dirigidoA} className={control} /></label>
      <label className="block space-y-2"><span className="font-semibold">Participantes</span><select name="audience" defaultValue={d.audience} className={control}><option value="INTERNAL">Internos (con usuario y contraseña)</option><option value="EXTERNAL">Externos (sin cuenta)</option><option value="BOTH">Internos y externos</option></select></label>
      <label className="block space-y-2"><span className="font-semibold">Modalidad</span><select name="modalidad" defaultValue={d.modalidad} className={control}><option value="VIRTUAL">Virtual</option><option value="PRESENCIAL">Presencial</option><option value="MIXTA">Mixta</option></select></label>
      <label className="block space-y-2"><span className="font-semibold">Lugar / sala</span><input name="lugar" defaultValue={d.lugar} className={control} /></label>
      <button className={`${button} w-full`}><CheckCircle2 className="h-4 w-4" />Guardar datos de la reunión</button>
    </fieldset>
  </form>;
}
