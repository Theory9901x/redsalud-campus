"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Eye, EyeOff, Link2, Loader2, Pencil, RefreshCcw, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { duracionTexto } from "@/lib/videoteca/formato";
import { actualizarVideo, eliminarVideo, publicarVideo, reprocesarVideo } from "@/app/admin/videos/acciones";

type Vista = { nombre: string; area: string | null; avance: number; completado: boolean; ultimaVez: Date };
export type FilaVideo = {
  id: string;
  titulo: string;
  descripcion: string | null;
  categoria: string | null;
  duracionSeg: number | null;
  conPortada: boolean;
  estado: string;
  publicado: boolean;
  creado: Date;
  tamano: number;
  personas: number;
  completos: number;
  vistas: Vista[];
};

const FECHA = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" });
const MB = (b: number) => `${(b / 1024 / 1024).toFixed(b > 100 * 1024 * 1024 ? 0 : 1)} MB`;

export function ListaVideosAdmin({ videos, soloLectura }: { videos: FilaVideo[]; soloLectura: boolean }) {
  if (!videos.length) {
    return <p className="surface-panel p-6 text-center text-[14px] text-muted-foreground">Todavía no hay videos. Sube el primero arriba.</p>;
  }
  return (
    <ul className="grid gap-3">
      {videos.map((v) => (
        <FilaAdmin key={v.id} v={v} soloLectura={soloLectura} />
      ))}
    </ul>
  );
}

function FilaAdmin({ v, soloLectura }: { v: FilaVideo; soloLectura: boolean }) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [editando, setEditando] = useState(false);
  const [verVistas, setVerVistas] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [f, setF] = useState({ titulo: v.titulo, descripcion: v.descripcion ?? "", categoria: v.categoria ?? "", publicado: v.publicado });

  const ejecutar = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>, exito: string, despues?: () => void) =>
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error);
      toast.success(exito);
      despues?.();
      router.refresh();
    });

  return (
    <li className="surface-panel overflow-hidden">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start">
        <Link href={`/videos/${v.id}`} target="_blank" className="relative aspect-video w-full shrink-0 overflow-hidden rounded-xl bg-[oklch(40%_0.08_235)] sm:w-52">
          {v.conPortada && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/videos/${v.id}/portada`} alt="" className="absolute inset-0 h-full w-full object-cover" />
          )}
          {duracionTexto(v.duracionSeg) && <span className="absolute bottom-1.5 right-1.5 rounded-md bg-black/70 px-1.5 py-0.5 font-mono text-[11px] text-white">{duracionTexto(v.duracionSeg)}</span>}
        </Link>

        <div className="min-w-0 flex-1">
          {editando ? (
            <div className="grid gap-2">
              <input value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} maxLength={160} className="h-9 rounded-lg border border-border bg-background px-3 text-[14px] font-semibold" aria-label="Título" />
              <input value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value })} maxLength={60} placeholder="Área o tema" className="h-9 rounded-lg border border-border bg-background px-3 text-[13px]" aria-label="Área o tema" />
              <textarea value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} rows={3} maxLength={2000} placeholder="Descripción" className="rounded-lg border border-border bg-background px-3 py-2 text-[13px]" aria-label="Descripción" />
              <label className="inline-flex items-center gap-2 text-[13px]">
                <input type="checkbox" checked={f.publicado} onChange={(e) => setF({ ...f, publicado: e.target.checked })} />
                Publicado (visible para todo el personal)
              </label>
              <div className="flex gap-2">
                <Button type="button" size="sm" disabled={pendiente} onClick={() => ejecutar(() => actualizarVideo(v.id, f), "Video actualizado.", () => setEditando(false))} className="gap-1.5">
                  {pendiente ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Guardar
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setEditando(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {v.categoria && <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">{v.categoria}</span>}
                <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-bold", v.publicado ? "border-success/30 bg-success/10 text-success" : "border-border bg-muted text-muted-foreground")}>{v.publicado ? "Publicado" : "Oculto"}</span>
                {v.estado === "PROCESANDO" && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning/15 px-2 py-0.5 text-[11px] font-bold text-warning-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> Optimizando para celular
                  </span>
                )}
                {v.estado === "ERROR" && <span className="rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[11px] font-bold text-destructive">No se pudo optimizar (se ve el original)</span>}
              </div>
              <h3 className="mt-1.5 text-[15px] font-bold leading-snug text-foreground">{v.titulo}</h3>
              {v.descripcion && <p className="mt-0.5 line-clamp-2 text-[13px] text-muted-foreground">{v.descripcion}</p>}
              <p className="mt-1.5 text-[12px] text-muted-foreground">
                {MB(v.tamano)} · subido {FECHA.format(v.creado)}
              </p>
            </>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setVerVistas((x) => !x)} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-[12.5px] font-semibold hover:border-primary/40">
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              {v.personas} {v.personas === 1 ? "persona" : "personas"} · {v.completos} completo{v.completos === 1 ? "" : "s"}
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", verVistas && "rotate-180")} aria-hidden="true" />
            </button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={async () => {
                await navigator.clipboard.writeText(`${window.location.origin}/videos/${v.id}`).catch(() => {});
                setCopiado(true);
                setTimeout(() => setCopiado(false), 2000);
              }}
            >
              {copiado ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
              {copiado ? "Copiado" : "Copiar enlace"}
            </Button>
            {!soloLectura && !editando && (
              <>
                <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => setEditando(true)}>
                  <Pencil className="h-3.5 w-3.5" /> Editar
                </Button>
                <Button type="button" size="sm" variant="outline" className="gap-1.5" disabled={pendiente} onClick={() => ejecutar(() => publicarVideo(v.id, !v.publicado), v.publicado ? "Video oculto." : "Video publicado.")}>
                  {v.publicado ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {v.publicado ? "Ocultar" : "Publicar"}
                </Button>
                {v.estado === "ERROR" && (
                  <Button type="button" size="sm" variant="outline" className="gap-1.5" disabled={pendiente} onClick={() => ejecutar(() => reprocesarVideo(v.id), "Optimizando de nuevo.")}>
                    <RefreshCcw className="h-3.5 w-3.5" /> Reintentar
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-destructive hover:text-destructive"
                  disabled={pendiente}
                  onClick={() => {
                    if (confirm(`¿Eliminar «${v.titulo}»? Se borra el video y el registro de quién lo vio.`)) ejecutar(() => eliminarVideo(v.id), "Video eliminado.");
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Eliminar
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {verVistas && (
        <div className="border-t border-border/70 bg-muted/30 px-4 py-3">
          {v.vistas.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">Nadie lo ha abierto todavía.</p>
          ) : (
            <div className="max-h-80 overflow-auto">
              <table className="w-full text-[13px]">
                <thead className="text-left text-[11.5px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="py-1.5 pr-3 font-semibold">Persona</th>
                    <th className="py-1.5 pr-3 font-semibold">Avance</th>
                    <th className="py-1.5 font-semibold">Última vez</th>
                  </tr>
                </thead>
                <tbody>
                  {v.vistas.map((x, i) => (
                    <tr key={i} className="border-t border-border/50">
                      <td className="py-1.5 pr-3">
                        <b className="font-semibold">{x.nombre}</b>
                        {x.area && <span className="block text-[11.5px] text-muted-foreground">{x.area}</span>}
                      </td>
                      <td className="py-1.5 pr-3">
                        {x.completado ? (
                          <span className="font-semibold text-success">Completo</span>
                        ) : (
                          <span className="inline-flex items-center gap-2">
                            <span className="h-1.5 w-20 overflow-hidden rounded-full bg-border">
                              <span className="block h-full bg-primary" style={{ width: `${Math.round(x.avance * 100)}%` }} />
                            </span>
                            {Math.round(x.avance * 100)}%
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 text-muted-foreground">{FECHA.format(x.ultimaVez)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
