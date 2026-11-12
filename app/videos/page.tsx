import Link from "next/link";
import { Clapperboard, Play } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { veComoAdmin } from "@/lib/roles";
import { videotecaPara } from "@/lib/videoteca/consultas";
import { puedeVerVideoteca } from "@/lib/videoteca/acceso";
import { duracionTexto } from "@/lib/videoteca/formato";
import { CabeceraVideoteca, matizCategoria, Miniatura, TarjetaVideo } from "@/components/videoteca/piezas";

export const dynamic = "force-dynamic";

/**
 * VIDEOTECA: los videos de capacitación del personal SIAU (traen datos de
 * acceso de esa área, así que no son para todo el campus: la regla está en
 * lib/videoteca/acceso.ts). Se reproducen aquí mismo, en el celular o el
 * computador, sin Drive ni descargas. Arriba el más reciente; abajo, por área.
 */
export default async function VideotecaPage({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  // Personal SIAU (o quien gestiona la videoteca): todos los publicados. El
  // resto, con o sin sesión, solo los que se marcaron como públicos.
  const sesion = await auth();
  const usuario = sesion?.user ?? null;
  const esAdmin = veComoAdmin(usuario?.role);
  const acceso = await puedeVerVideoteca(usuario);
  const [{ cat }, videos, ajustes] = await Promise.all([
    searchParams,
    videotecaPara(usuario?.id ?? null, esAdmin, acceso),
    prisma.institutionSettings.findUnique({ where: { id: "singleton" }, select: { institutionName: true, logoUrl: true } }),
  ]);
  const volverA = !usuario ? "/login?callbackUrl=%2Fvideos" : esAdmin ? "/admin" : usuario.role === "TUTOR" ? "/tutor" : "/inicio";

  const categorias = [...new Set(videos.map((v) => v.categoria ?? "General"))].sort((a, b) => a.localeCompare(b, "es"));
  const filtrados = cat ? videos.filter((v) => (v.categoria ?? "General") === cat) : videos;
  const destacado = filtrados[0];
  const grupos = categorias
    .map((c) => ({ c, lista: filtrados.filter((v) => (v.categoria ?? "General") === c) }))
    .filter((g) => g.lista.length);

  return (
    <main className="vt">
      <CabeceraVideoteca logoUrl={ajustes?.logoUrl ?? null} institucion={ajustes?.institutionName ?? "Red Salud Casanare E.S.E."} volverA={volverA} volverTexto={usuario ? "Volver al campus" : "Iniciar sesión"} />
      <div className="vt-cuerpo">
        <section className="vt-intro vt-entrada">
          <span className="vt-mono">Videoteca · {videos.length} {videos.length === 1 ? "video" : "videos"}</span>
          <h1>Aprende a tu ritmo</h1>
          <p>Los videos de las capacitaciones de la red. Ábrelos desde el celular o el computador: se reproducen aquí mismo y, si los dejas a medias, siguen donde quedaste.</p>
        </section>

        {categorias.length > 1 && (
          <nav className="vt-filtros" aria-label="Áreas">
            <Link href="/videos" className="vt-filtro" aria-pressed={!cat}>
              Todos
            </Link>
            {categorias.map((c) => (
              <Link key={c} href={`/videos?cat=${encodeURIComponent(c)}`} className="vt-filtro" aria-pressed={cat === c}>
                {c}
              </Link>
            ))}
          </nav>
        )}

        {!destacado ? (
          <div className="vt-vacio">
            <Clapperboard className="h-9 w-9" aria-hidden="true" />
            <b>Todavía no hay videos publicados.</b>
            <span>Cuando Talento Humano suba uno, aparecerá aquí.</span>
          </div>
        ) : (
          <>
            <Link href={`/videos/${destacado.id}`} className="vt-destacado vt-entrada" style={{ ["--i" as string]: 1, ["--vt-h" as string]: matizCategoria(destacado.categoria) }}>
              <Miniatura v={destacado} grande />
              <span className="texto">
                <span className="vt-mono vt-cat">
                  {destacado.completado ? "Ya lo viste" : destacado.avance > 0 ? "Continúa donde quedaste" : "Lo más reciente"}
                  {destacado.categoria ? ` · ${destacado.categoria}` : ""}
                </span>
                <h2>{destacado.titulo}</h2>
                {destacado.descripcion && <p>{destacado.descripcion}</p>}
                <span className="vt-boton">
                  <Play className="h-4 w-4" fill="currentColor" aria-hidden="true" />
                  {destacado.avance > 0 && !destacado.completado ? "Continuar" : "Ver video"}
                  {duracionTexto(destacado.duracionSeg) ? ` · ${duracionTexto(destacado.duracionSeg)}` : ""}
                </span>
              </span>
            </Link>

            {grupos.map((g, gi) => (
              <section key={g.c} className="vt-grupo" style={{ ["--vt-h" as string]: matizCategoria(g.c) }}>
                <header>
                  <h3>{g.c}</h3>
                  <span className="vt-mono">{g.lista.length}</span>
                </header>
                <div className="vt-rejilla">
                  {g.lista.map((v, i) => (
                    <TarjetaVideo key={v.id} v={v} i={gi * 2 + i + 2} />
                  ))}
                </div>
              </section>
            ))}
          </>
        )}
      </div>
    </main>
  );
}
