import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { veComoAdmin } from "@/lib/roles";
import { videoPara, videotecaPara } from "@/lib/videoteca/consultas";
import { duracionTexto } from "@/lib/videoteca/formato";
import { CabeceraVideoteca, matizCategoria, Miniatura } from "@/components/videoteca/piezas";
import { Reproductor } from "@/components/videoteca/reproductor";
import { AccesoVideo, type DatoAcceso } from "@/components/videoteca/acceso-video";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = await prisma.videoCapacitacion.findUnique({ where: { id }, select: { titulo: true } });
  return { title: v ? `${v.titulo} · Videoteca` : "Videoteca" };
}

/** Líneas "Plataforma: …", "Usuario: …", "Contraseña: …" de la descripción: se muestran aparte, como datos de acceso. */
const ACCESO = /^\s*(plataforma|enlace|link|usuario|contraseña|clave)\s*:\s*(.+)$/i;
function separarAcceso(descripcion: string | null) {
  const datos: DatoAcceso[] = [];
  const resto: string[] = [];
  for (const linea of (descripcion ?? "").split(/\r?\n/)) {
    const m = linea.match(ACCESO);
    if (m) datos.push({ etiqueta: m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase(), valor: m[2].trim() });
    else resto.push(linea);
  }
  return { datos, texto: resto.join("\n").replace(/\n*(c[oó]mo entrar|acceso)\s*:?\s*$/i, "").trim() };
}

const FECHA = new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeZone: "America/Bogota" });

/** Un video de la Videoteca: el reproductor grande y, al lado, los demás. */
export default async function VerVideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Un video público se ve sin cuenta; los demás piden iniciar sesión.
  const sesion = await auth();
  const usuario = sesion?.user ?? null;
  const esAdmin = veComoAdmin(usuario?.role);
  const [v, todos, ajustes] = await Promise.all([
    videoPara(id, usuario?.id ?? null, esAdmin),
    videotecaPara(usuario?.id ?? null, esAdmin),
    prisma.institutionSettings.findUnique({ where: { id: "singleton" }, select: { institutionName: true, logoUrl: true } }),
  ]);
  if (v === "LOGIN") redirect(`/login?callbackUrl=${encodeURIComponent(`/videos/${id}`)}`);
  if (!v) notFound();
  const { datos: acceso, texto: descripcion } = separarAcceso(v.descripcion);
  const otros = [...todos.filter((x) => x.id !== v.id && x.categoria === v.categoria), ...todos.filter((x) => x.id !== v.id && x.categoria !== v.categoria)].slice(0, 8);

  return (
    <main className="vt" style={{ ["--vt-h" as string]: matizCategoria(v.categoria) }}>
      <CabeceraVideoteca logoUrl={ajustes?.logoUrl ?? null} institucion={ajustes?.institutionName ?? "Red Salud Casanare E.S.E."} volverA="/videos" volverTexto={usuario ? "Todos los videos" : "Más videos"} />
      <div className="vt-cuerpo">
        <div className={otros.length ? "vt-ver" : "vt-ver vt-ver-solo"}>
          <section>
            <Reproductor id={v.id} src={v.src} tipo={v.tipo} portada={v.conPortada ? `/api/videos/${v.id}/portada` : null} posicion={v.posicion} duracion={v.duracionSeg} />
            <div className="vt-detalle">
              <span className="vt-mono vt-cat">
                {[v.categoria, duracionTexto(v.duracionSeg), FECHA.format(v.creado)].filter(Boolean).join(" · ")}
              </span>
              <h1>{v.titulo}</h1>
              {v.completado && (
                <span className="vt-mono inline-flex items-center gap-1.5" style={{ color: "oklch(42% 0.12 155)" }}>
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  Ya viste este video
                </span>
              )}
              {!v.publicado && <span className="vt-mono" style={{ color: "oklch(55% 0.14 60)" }}>Oculto · solo lo ven los administradores</span>}
              {descripcion && <p>{descripcion}</p>}
              {acceso.length > 0 && <AccesoVideo datos={acceso} titulo={v.titulo} />}
            </div>
          </section>

          {otros.length > 0 && (
            <aside className="vt-lado" aria-label="Más videos">
              <span className="vt-mono">Más videos</span>
              {otros.map((o) => (
                <Link key={o.id} href={`/videos/${o.id}`} className="vt-item" style={{ ["--vt-h" as string]: matizCategoria(o.categoria) }}>
                  <Miniatura v={o} />
                  <span className="grid gap-1">
                    {o.categoria && <span className="vt-mono vt-cat">{o.categoria}</span>}
                    <b>{o.titulo}</b>
                  </span>
                </Link>
              ))}
            </aside>
          )}
        </div>
      </div>
    </main>
  );
}
