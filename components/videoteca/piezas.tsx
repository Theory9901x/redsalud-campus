import Link from "next/link";
import { ArrowLeft, CheckCircle2, Clapperboard, Lock, Play } from "lucide-react";
import type { VideoLista } from "@/lib/videoteca/consultas";
import { duracionTexto, fechaCorta } from "@/lib/videoteca/formato";

/**
 * Color estable por área, SIEMPRE dentro de los azules y verdes de RedSalud
 * (azul, verde, cian y dos intermedios): un área se reconoce sin sacar
 * la página de los colores de la entidad. Devuelve el matiz oklch.
 */
const MATICES_MARCA = [234, 145, 205, 175, 250];
export function matizCategoria(categoria: string | null) {
  if (!categoria) return MATICES_MARCA[0];
  const fijos: Record<string, number> = { siau: 205, "talento humano": 234, calidad: 145, sistemas: 234, facturación: 175, financiero: 175 };
  const k = categoria.trim().toLowerCase();
  if (fijos[k] !== undefined) return fijos[k];
  let h = 0;
  for (const c of k) h = (h * 31 + c.charCodeAt(0)) % 9973;
  return MATICES_MARCA[h % MATICES_MARCA.length];
}

/** Publicado hace menos de dos semanas. */
const esReciente = (creado: Date) => Date.now() - creado.getTime() < 14 * 24 * 3600 * 1000;

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
        <b>Videos de capacitación</b>
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
        <span className="vt-visto">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          Visto
        </span>
      )}
      {dur && <span className="vt-duracion">{dur}</span>}
      {v.avance > 0 && !v.completado && (
        <span className="vt-barra" aria-hidden="true">
          <i style={{ width: `${Math.round(v.avance * 100)}%` }} />
        </span>
      )}
    </span>
  );
}

/**
 * Un video en la rejilla: portada, área (si la lista no está ya agrupada por
 * área), título, resumen y una línea de datos: fecha y estado.
 */
export function TarjetaVideo({ v, i = 0, mostrarArea = true }: { v: VideoLista; i?: number; mostrarArea?: boolean }) {
  const enCurso = v.avance > 0 && !v.completado;
  return (
    <Link href={`/videos/${v.id}`} className="vt-tarjeta vt-entrada" style={{ ["--i" as string]: i, ["--vt-h" as string]: matizCategoria(v.categoria) }}>
      <Miniatura v={v} />
      <span className="info">
        {mostrarArea && <span className="vt-cat">{v.categoria ?? "General"}</span>}
        <b>{v.titulo}</b>
        {v.descripcion && <p>{v.descripcion}</p>}
        <span className="vt-meta">
          <time dateTime={v.creado.toISOString()}>{fechaCorta(v.creado)}</time>
          {enCurso ? <span className="vt-estado" data-estado="curso">Vas en {Math.round(v.avance * 100)} %</span> : !v.completado && esReciente(v.creado) ? <span className="vt-estado" data-estado="nuevo">Nuevo</span> : null}
          {v.soloSiau && (
            <span className="vt-estado" data-estado="siau">
              <Lock className="h-3 w-3" aria-hidden="true" />
              Solo SIAU
            </span>
          )}
          {!v.publicado && <span className="vt-estado" data-estado="oculto">Oculto</span>}
        </span>
      </span>
    </Link>
  );
}
