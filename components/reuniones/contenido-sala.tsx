"use client";
import { useEffect, useState } from "react";
import { FileDown } from "lucide-react";
import type { ContenidoReunion } from "@/lib/reunion-contenido";
import { nombreLegibleDocumento } from "@/lib/documentos";

export function ContenidoSalaReunion({ activityId, inicial, panelHref }: { activityId: string; inicial: ContenidoReunion; panelHref?: string }) {
  const [data, setData] = useState(inicial);
  useEffect(() => {
    let vigente = true;
    const load = async () => { const r = await fetch(`/api/reuniones/sala/${activityId}/contenido`, { cache: "no-store" }); if (r.ok) { const d: ContenidoReunion = await r.json(); if (vigente) setData(d); } };
    const timer = setInterval(() => { if (document.visibilityState === "visible") void load().catch(() => {}); }, 15000);
    return () => { vigente = false; clearInterval(timer); };
  }, [activityId]);
  return <div id="contenido-reunion" className="space-y-4">
    {panelHref && <a target="_blank" rel="noopener noreferrer" href={panelHref} className="block rounded-xl border bg-card p-4 text-center text-base font-semibold text-primary">Abrir panel de la reunión para gestionar y editar</a>}
    <section className="space-y-4 rounded-xl border bg-card p-5"><h2 className="text-xl font-semibold">Compromisos de la reunión</h2><p className="text-base text-muted-foreground">Guardados desde el panel de la reunión.</p><ol className="list-inside list-decimal space-y-3">{data.compromisos.map((text, i) => <li key={i} className="whitespace-pre-wrap text-base leading-relaxed">{text}</li>)}</ol>{!data.compromisos.length && <p className="text-base text-muted-foreground">Todavía no hay compromisos registrados.</p>}</section>
    <section className="space-y-4 rounded-xl border bg-card p-5"><h2 className="text-xl font-semibold">Documentos asociados</h2>{data.documentos.map(doc => <article key={doc.id} className="space-y-2 rounded-lg border p-3"><p className="break-words text-base font-semibold">{nombreLegibleDocumento(doc.fileName)}</p>{doc.description && <p className="text-sm text-muted-foreground">{doc.description}</p>}<div className="flex gap-3"><a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="text-base font-semibold text-primary underline">Ver documento</a><a href={`${doc.fileUrl}?download=1`} download className="inline-flex items-center gap-2 text-base font-semibold text-primary underline"><FileDown className="h-4 w-4" />Descargar</a></div></article>)}{!data.documentos.length && <p className="text-base text-muted-foreground">No hay documentos asociados todavía.</p>}</section>
  </div>;
}
