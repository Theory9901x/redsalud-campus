import Link from "next/link";
import { ArrowLeft, CheckCircle2, Clapperboard, Play } from "lucide-react";
import type { VideoLista } from "@/lib/videoteca/consultas";
import { duracionTexto } from "@/lib/videoteca/formato";

/** Color estable por categoría (matiz oklch), para que cada área se reconozca. */
export function matizCategoria(categoria: string | null) {
  if (!categoria) return 235;
  const fijos: Record<string, number> = { siau: 200, "talento humano": 300, calidad: 155, sistemas: 255, facturación: 75, financiero: 75 };
  const k = categoria.trim().toLowerCase();
  if (fijos[k] !== undefined) return fijos[k];
  let h = 0;
  for (const c of k) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

export function CabeceraVideoteca({ logoUrl, institucion, volverA, volverTexto = "Volver al campus" }: { logoUrl: string | null; institucion: string; volverA: string; volverTexto?: string }) {
  return (
    <header className="vt-cabecera">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" />
      ) : (
        <Clapperboard className="h-7 w-7 text-[var(--vt-acento)]" aria-hidden="true" />
      )}
      <div className="marca">
        <b>Videoteca de capacitación</b>
        <span>{institucion}</span>
      </div>
      <Link href={volverA} className="vt-volver" aria-label={volverTexto}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        <span>{volverTexto}</span>
      </Link>
    </header>
  );
}

export function Miniatura({ v, grande = false }: { v: Pick<VideoLista, "id" | "conPortada" | "duracionSeg" | "avance" | "completado" | "categoria">; grande?: boolean }) {
  const dur = duracionTexto(v.duracionSeg);
  return (
    <span className="vt-mini" style={{ ["--vt-h" as string]: matizCategoria(v.categoria) }}>
      {v.conPortada && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/videos/${v.id}/portada`} alt="" loading="lazy" />
      )}
      <span className="vt-play" style={grande ? { width: "4.6rem", height: "4.6rem" } : undefined}>
        <Play className={grande ? "h-7 w-7" : "h-5 w-5"} fill="currentColor" aria-hidden="true" />
      </span>
      {v.completado && (
        <span className="vt-visto vt-mono">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          Visto
        </span>
      )}
      {dur && <span className="vt-duracion vt-mono">{dur}</span>}
      {v.avance > 0 && !v.completado && (
        <span className="vt-barra" aria-hidden="true">
          <i style={{ width: `${Math.round(v.avance * 100)}%` }} />
        </span>
      )}
    </span>
  );
}

export function TarjetaVideo({ v, i = 0 }: { v: VideoLista; i?: number }) {
  return (
    <Link href={`/videos/${v.id}`} className="vt-tarjeta vt-entrada" style={{ ["--i" as string]: i, ["--vt-h" as string]: matizCategoria(v.categoria) }}>
      <Miniatura v={v} />
      <span className="info">
        {v.categoria && <span className="vt-mono vt-cat">{v.categoria}</span>}
        <b>{v.titulo}</b>
        {v.descripcion && <p>{v.descripcion}</p>}
        {!v.publicado && <span className="vt-mono" style={{ color: "oklch(55% 0.14 60)" }}>Oculto · solo administradores</span>}
      </span>
    </Link>
  );
}
