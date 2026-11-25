import Link from "next/link";
import { CalendarDays, Clapperboard, FolderOpen, Play, Search, X } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { veComoAdmin } from "@/lib/roles";
import { videotecaPara, type VideoLista } from "@/lib/videoteca/consultas";
import { veVideosSiau } from "@/lib/videoteca/acceso";
import { duracionLarga, duracionTexto, fechaCorta, mesTexto } from "@/lib/videoteca/formato";
import { CabeceraVideoteca, matizCategoria, Miniatura, TarjetaVideo } from "@/components/videoteca/piezas";

export const dynamic = "force-dynamic";

type Parametros = { cat?: string; vista?: string; orden?: string; q?: string };

const SIN_AREA = "General";
const areaDe = (v: VideoLista) => v.categoria ?? SIN_AREA;
const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const sumaDuracion = (lista: VideoLista[]) => lista.reduce((s, v) => s + (v.duracionSeg ?? 0), 0);

/**
 * VIDEOTECA: los videos de capacitación para estudiantes y docentes. Los del
 * área SIAU traen datos de acceso de esa área y solo los ve su personal y los
 * administradores (la regla está en lib/videoteca/acceso.ts). Se reproducen
 * aquí mismo, en el celular o el computador, sin Drive ni descargas.
 *
 * Siempre va ordenada: por ÁREA (por defecto) o por FECHA (mes a mes), con
 * filtro de área, orden y buscador. Todo viaja en la URL (sin JavaScript), así
 * que un enlace a "Calidad, por fecha" se puede compartir.
 */
export default async function VideotecaPage({ searchParams }: { searchParams: Promise<Parametros> }) {
  // Con sesión: los publicados, menos los de SIAU (esos, solo su personal y
  // quien gestiona la videoteca). Sin sesión: solo los marcados como públicos.
  const sesion = await auth();
  const usuario = sesion?.user ?? null;
  const esAdmin = veComoAdmin(usuario?.role);
  const acceso = await veVideosSiau(usuario);
  const [params, videos, ajustes] = await Promise.all([
    searchParams,
    videotecaPara(usuario?.id ?? null, esAdmin, acceso),
    prisma.institutionSettings.findUnique({ where: { id: "singleton" }, select: { institutionName: true, logoUrl: true } }),
  ]);
  const volverA = !usuario ? "/login?callbackUrl=%2Fvideos" : esAdmin ? "/admin" : usuario.role === "TUTOR" ? "/tutor" : "/inicio";

  const porFecha = params.vista === "fecha";
  const antiguos = params.orden === "antiguos";
  const q = (params.q ?? "").trim().slice(0, 80);
  const areas = [...new Set(videos.map(areaDe))].sort((a, b) => a.localeCompare(b, "es"));
  const cat = params.cat && areas.includes(params.cat) ? params.cat : null;

  /** La misma página con otros filtros; lo que no se nombra, se conserva. */
  const enlace = (cambios: Partial<Record<keyof Parametros, string | null>>) => {
    const actual: Record<string, string | null> = { cat, vista: porFecha ? "fecha" : null, orden: antiguos ? "antiguos" : null, q: q || null, ...cambios };
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(actual)) if (v) sp.set(k, v);
    const s = sp.toString();
    return s ? `/videos?${s}` : "/videos";
  };

  const buscado = q ? sinTildes(q) : null;
  const filtrados = videos
    .filter((v) => !cat || areaDe(v) === cat)
    .filter((v) => !buscado || sinTildes(`${v.titulo} ${v.descripcion ?? ""} ${v.categoria ?? ""}`).includes(buscado))
    .sort((a, b) => (antiguos ? a.creado.getTime() - b.creado.getTime() : b.creado.getTime() - a.creado.getTime()));

  // Grupos: por área (alfabético) o por mes (en el orden elegido).
  const grupos: { clave: string; titulo: string; lista: VideoLista[] }[] = [];
  if (porFecha) {
    for (const v of filtrados) {
      const titulo = mesTexto(v.creado);
      const g = grupos.find((x) => x.clave === titulo);
      if (g) g.lista.push(v);
      else grupos.push({ clave: titulo, titulo, lista: [v] });
    }
  } else {
    for (const a of areas) {
      const lista = filtrados.filter((v) => areaDe(v) === a);
      if (lista.length) grupos.push({ clave: a, titulo: a, lista });
    }
  }

  // Arriba: lo que la persona dejó a medias; si no hay, lo más reciente.
  const sinFiltros = !cat && !q;
  const aMedias = videos.find((v) => v.avance > 0 && !v.completado);
  const destacado = sinFiltros ? (aMedias ?? [...videos].sort((a, b) => b.creado.getTime() - a.creado.getTime())[0]) : undefined;
  const vistos = videos.filter((v) => v.completado).length;
  const total = sumaDuracion(videos);

  return (
    <main className="vt">
      <CabeceraVideoteca logoUrl={ajustes?.logoUrl ?? null} institucion={ajustes?.institutionName ?? "Red Salud Casanare E.S.E."} volverA={volverA} volverTexto={usuario ? "Volver al campus" : "Iniciar sesión"} />
      <div className="vt-cuerpo">
        <section className="vt-intro vt-entrada">
          <div>
            <h1>Videos de capacitación</h1>
            <p>Las capacitaciones de la red, organizadas por área y por fecha. Se reproducen aquí mismo, en el celular o el computador, y si dejas uno a medias sigue donde quedaste.</p>
          </div>
          {videos.length > 0 && (
            <dl className="vt-cifras">
              <div>
                <dt>Videos</dt>
                <dd>{videos.length}</dd>
              </div>
              <div>
                <dt>{areas.length === 1 ? "Área" : "Áreas"}</dt>
                <dd>{areas.length}</dd>
              </div>
              {total > 0 && (
                <div>
                  <dt>Duración total</dt>
                  <dd>{duracionLarga(total)}</dd>
                </div>
              )}
              {usuario && (
                <div className="vt-cifra-avance">
                  <dt>Has visto</dt>
                  <dd>
                    {vistos} de {videos.length}
                  </dd>
                  <span className="vt-progreso" role="progressbar" aria-valuemin={0} aria-valuemax={videos.length} aria-valuenow={vistos} aria-label="Videos vistos">
                    <i style={{ width: `${Math.round((vistos / videos.length) * 100)}%` }} />
                  </span>
                </div>
              )}
            </dl>
          )}
        </section>

        {videos.length === 0 ? (
          <div className="vt-vacio">
            <Clapperboard className="h-9 w-9" aria-hidden="true" />
            <b>Todavía no hay videos publicados.</b>
            <span>Cuando Talento Humano suba uno, aparecerá aquí.</span>
          </div>
        ) : (
          <>
            {destacado && (
              <Link href={`/videos/${destacado.id}`} className="vt-destacado vt-entrada" style={{ ["--i" as string]: 1, ["--vt-h" as string]: matizCategoria(destacado.categoria) }}>
                <Miniatura v={destacado} grande />
                <span className="texto">
                  <span className="vt-etiqueta">{destacado.completado ? "Ya lo viste" : destacado.avance > 0 ? "Continúa donde quedaste" : "Lo más reciente"}</span>
                  <h2>{destacado.titulo}</h2>
                  <span className="vt-meta">
                    <span className="vt-cat">{areaDe(destacado)}</span>
                    <span>{fechaCorta(destacado.creado)}</span>
                    {duracionTexto(destacado.duracionSeg) && <span>{duracionLarga(destacado.duracionSeg)}</span>}
                  </span>
                  {destacado.descripcion && <p>{destacado.descripcion}</p>}
                  <span className="vt-boton">
                    <Play className="h-4 w-4" fill="currentColor" aria-hidden="true" />
                    {destacado.avance > 0 && !destacado.completado ? `Continuar · ${Math.round(destacado.avance * 100)} %` : "Ver video"}
                  </span>
                </span>
              </Link>
            )}

            <div className="vt-barra-filtros">
              <form action="/videos" className="vt-buscar" role="search">
                {cat && <input type="hidden" name="cat" value={cat} />}
                {porFecha && <input type="hidden" name="vista" value="fecha" />}
                {antiguos && <input type="hidden" name="orden" value="antiguos" />}
                <Search className="h-4 w-4" aria-hidden="true" />
                <input type="search" name="q" defaultValue={q} placeholder="Buscar un video o un tema" aria-label="Buscar videos" maxLength={80} />
                <button type="submit">Buscar</button>
              </form>

              <div className="vt-opciones">
                <div className="vt-segmento" role="group" aria-label="Agrupar">
                  <Link href={enlace({ vista: null })} aria-current={!porFecha ? "true" : undefined}>
                    <FolderOpen className="h-4 w-4" aria-hidden="true" />
                    Por área
                  </Link>
                  <Link href={enlace({ vista: "fecha" })} aria-current={porFecha ? "true" : undefined}>
                    <CalendarDays className="h-4 w-4" aria-hidden="true" />
                    Por fecha
                  </Link>
                </div>
                <div className="vt-segmento" role="group" aria-label="Orden">
                  <Link href={enlace({ orden: null })} aria-current={!antiguos ? "true" : undefined}>
                    Más recientes
                  </Link>
                  <Link href={enlace({ orden: "antiguos" })} aria-current={antiguos ? "true" : undefined}>
                    Más antiguos
                  </Link>
                </div>
              </div>
            </div>

            <nav className="vt-filtros" aria-label="Áreas">
              <Link href={enlace({ cat: null })} className="vt-filtro" aria-current={!cat ? "true" : undefined}>
                Todas las áreas <span>{videos.length}</span>
              </Link>
              {areas.map((a) => (
                <Link key={a} href={enlace({ cat: a })} className="vt-filtro" aria-current={cat === a ? "true" : undefined} style={{ ["--vt-h" as string]: matizCategoria(a) }}>
                  <i aria-hidden="true" />
                  {a} <span>{videos.filter((v) => areaDe(v) === a).length}</span>
                </Link>
              ))}
            </nav>

            {(cat || q) && (
              <p className="vt-resultado">
                {filtrados.length === 0 ? "Ningún video" : filtrados.length === 1 ? "1 video" : `${filtrados.length} videos`}
                {cat ? ` en ${cat}` : ""}
                {q ? ` para «${q}»` : ""}
                <Link href={enlace({ cat: null, q: null })}>
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  Quitar filtros
                </Link>
              </p>
            )}

            {grupos.length === 0 ? (
              <div className="vt-vacio">
                <Search className="h-8 w-8" aria-hidden="true" />
                <b>No encontramos videos con esos filtros.</b>
                <span>Prueba con otra palabra o revisa todas las áreas.</span>
              </div>
            ) : (
              grupos.map((g, gi) => (
                <section key={g.clave} className="vt-grupo" style={porFecha ? undefined : { ["--vt-h" as string]: matizCategoria(g.titulo) }}>
                  <header>
                    <h2>{g.titulo}</h2>
                    <p>
                      {g.lista.length === 1 ? "1 video" : `${g.lista.length} videos`}
                      {sumaDuracion(g.lista) > 0 ? ` · ${duracionLarga(sumaDuracion(g.lista))}` : ""}
                      {!porFecha ? ` · actualizado el ${fechaCorta(new Date(Math.max(...g.lista.map((v) => v.creado.getTime()))))}` : ""}
                    </p>
                  </header>
                  <div className="vt-rejilla">
                    {g.lista.map((v, i) => (
                      <TarjetaVideo key={v.id} v={v} i={Math.min(gi * 2 + i + 2, 12)} mostrarArea={porFecha || !!cat} />
                    ))}
                  </div>
                </section>
              ))
            )}
          </>
        )}
      </div>
    </main>
  );
}
