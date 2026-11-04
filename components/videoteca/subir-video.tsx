"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CloudUpload, FileVideo, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Estado = { fase: "eligiendo" } | { fase: "subiendo"; enviados: number; total: number; velocidad: number } | { fase: "terminando" };

const MB = (b: number) => `${(b / 1024 / 1024).toFixed(b > 100 * 1024 * 1024 ? 0 : 1)} MB`;
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

function leerDuracion(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      const d = Number.isFinite(v.duration) ? Math.round(v.duration) : null;
      URL.revokeObjectURL(url);
      resolve(d);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    v.src = url;
  });
}

function tituloDesdeNombre(nombre: string) {
  const base = nombre.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/**
 * Subir un video a la Videoteca. Va en partes de 8 MB con reintento: un
 * corte de red a mitad no obliga a empezar de nuevo esa parte ni las demás.
 */
export function SubirVideo({ categorias }: { categorias: string[] }) {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const cancelar = useRef(false);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [duracion, setDuracion] = useState<number | null>(null);
  const [titulo, setTitulo] = useState("");
  const [categoria, setCategoria] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [estado, setEstado] = useState<Estado>({ fase: "eligiendo" });
  const [arrastrando, setArrastrando] = useState(false);

  const elegir = async (f: File | undefined | null) => {
    if (!f) return;
    if (!f.type.startsWith("video/")) {
      toast.error("Ese archivo no es un video.");
      return;
    }
    setArchivo(f);
    if (!titulo) setTitulo(tituloDesdeNombre(f.name));
    setDuracion(await leerDuracion(f));
  };

  const subir = async () => {
    if (!archivo || !titulo.trim()) return;
    cancelar.current = false;
    window.addEventListener("beforeunload", avisar);
    try {
      const r = await fetch("/api/videos/subir?op=iniciar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: archivo.name, tipo: archivo.type, tamano: archivo.size, titulo, categoria, descripcion, duracionSeg: duracion }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "No se pudo iniciar la carga.");
      const { id, tamanoParte } = j as { id: string; tamanoParte: number };

      let desde = 0;
      const inicio = performance.now();
      setEstado({ fase: "subiendo", enviados: 0, total: archivo.size, velocidad: 0 });
      while (desde < archivo.size) {
        if (cancelar.current) throw new Error("Carga cancelada.");
        const parte = archivo.slice(desde, Math.min(archivo.size, desde + tamanoParte));
        let intento = 0;
        for (;;) {
          try {
            const rp = await fetch(`/api/videos/subir?op=parte&id=${id}&desde=${desde}`, { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: parte });
            const jp = await rp.json();
            if (!rp.ok) throw new Error(jp.error ?? "Error en una parte.");
            desde = jp.recibidos as number;
            break;
          } catch (e) {
            intento += 1;
            if (intento >= 5 || cancelar.current) throw e;
            await espera(1500 * intento);
          }
        }
        const seg = (performance.now() - inicio) / 1000;
        setEstado({ fase: "subiendo", enviados: desde, total: archivo.size, velocidad: seg > 0 ? desde / seg : 0 });
      }

      setEstado({ fase: "terminando" });
      const rt = await fetch(`/api/videos/subir?op=terminar&id=${id}`, { method: "POST" });
      const jt = await rt.json();
      if (!rt.ok) throw new Error(jt.error ?? "No se pudo cerrar la carga.");
      toast.success("Video publicado. Se está optimizando para celular; ya se puede ver.");
      setArchivo(null);
      setTitulo("");
      setDescripcion("");
      setDuracion(null);
      setEstado({ fase: "eligiendo" });
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo subir el video.");
      setEstado({ fase: "eligiendo" });
    } finally {
      window.removeEventListener("beforeunload", avisar);
    }
  };

  const ocupado = estado.fase !== "eligiendo";
  const pct = estado.fase === "subiendo" ? Math.round((estado.enviados / estado.total) * 100) : estado.fase === "terminando" ? 100 : 0;
  const restante = estado.fase === "subiendo" && estado.velocidad > 0 ? Math.max(0, Math.round((estado.total - estado.enviados) / estado.velocidad)) : null;

  return (
    <section className="surface-panel overflow-hidden" aria-label="Subir video">
      <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <button
          type="button"
          disabled={ocupado}
          onClick={() => entrada.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setArrastrando(true);
          }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={(e) => {
            e.preventDefault();
            setArrastrando(false);
            void elegir(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            "flex min-h-[190px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-colors",
            arrastrando ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/40",
          )}
        >
          {archivo ? (
            <>
              <FileVideo className="h-9 w-9 text-primary" aria-hidden="true" />
              <b className="max-w-full truncate text-[14px]">{archivo.name}</b>
              <span className="text-[12.5px] text-muted-foreground">
                {MB(archivo.size)}
                {duracion ? ` · ${Math.floor(duracion / 60)}:${String(duracion % 60).padStart(2, "0")}` : ""} · toca para cambiarlo
              </span>
            </>
          ) : (
            <>
              <CloudUpload className="h-9 w-9 text-primary" aria-hidden="true" />
              <b className="text-[14px]">Arrastra el video aquí o tócalo para elegirlo</b>
              <span className="text-[12.5px] text-muted-foreground">MP4, MOV o WebM · hasta 2 GB. Se optimiza solo para verse bien en el celular.</span>
            </>
          )}
          <input ref={entrada} type="file" accept="video/*" className="hidden" onChange={(e) => void elegir(e.target.files?.[0])} />
        </button>

        <div className="grid content-start gap-3">
          <label className="grid gap-1.5 text-[13px] font-semibold">
            Título
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} disabled={ocupado} maxLength={160} placeholder="Ej.: Capacitación exporte info SIAU" className="h-10 rounded-lg border border-border bg-background px-3 text-[14px] font-normal" />
          </label>
          <label className="grid gap-1.5 text-[13px] font-semibold">
            Área o tema
            <input value={categoria} onChange={(e) => setCategoria(e.target.value)} disabled={ocupado} maxLength={60} list="categorias-video" placeholder="Ej.: SIAU" className="h-10 rounded-lg border border-border bg-background px-3 text-[14px] font-normal" />
            <datalist id="categorias-video">
              {[...new Set(["SIAU", ...categorias])].map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <label className="grid gap-1.5 text-[13px] font-semibold">
            Descripción <span className="font-normal text-muted-foreground">(opcional)</span>
            <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} disabled={ocupado} rows={3} maxLength={2000} placeholder="Qué se aprende en el video y para quién es." className="rounded-lg border border-border bg-background px-3 py-2 text-[14px] font-normal" />
          </label>

          {ocupado ? (
            <div className="grid gap-2 rounded-xl border border-border bg-muted/40 p-3">
              <div className="flex items-center justify-between gap-3 text-[13px] font-semibold">
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
                  {estado.fase === "terminando" ? "Guardando y publicando…" : `Subiendo… ${pct}%`}
                </span>
                {estado.fase === "subiendo" && (
                  <span className="font-mono text-[12px] text-muted-foreground">
                    {MB(estado.enviados)} / {MB(estado.total)}
                    {restante !== null ? ` · ~${restante > 90 ? `${Math.round(restante / 60)} min` : `${restante} s`}` : ""}
                  </span>
                )}
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-border" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] text-muted-foreground">No cierres esta pestaña hasta que termine.</span>
                {estado.fase === "subiendo" && (
                  <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => (cancelar.current = true)}>
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                    Cancelar
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <Button type="button" onClick={subir} disabled={!archivo || !titulo.trim()} className="h-10 gap-2">
              <CloudUpload className="h-4 w-4" aria-hidden="true" />
              Subir y publicar
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

function avisar(e: BeforeUnloadEvent) {
  e.preventDefault();
}
