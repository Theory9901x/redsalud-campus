import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { requireSession } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { veComoAdmin } from "@/lib/roles";
import { videoPara, videotecaPara } from "@/lib/videoteca/consultas";
import { duracionTexto } from "@/lib/videoteca/formato";
import { CabeceraVideoteca, matizCategoria, Miniatura } from "@/components/videoteca/piezas";
import { Reproductor } from "@/components/videoteca/reproductor";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = await prisma.videoCapacitacion.findUnique({ where: { id }, select: { titulo: true } });
  return { title: v ? `${v.titulo} · Videoteca` : "Videoteca" };
}

const FECHA = new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeZone: "America/Bogota" });

/** Un video de la Videoteca: el reproductor grande y, al lado, los demás. */
export default async function VerVideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sesion = await requireSession(`/videos/${id}`);
  const esAdmin = veComoAdmin(sesion.user.role);
  const [v, todos, ajustes] = await Promise.all([
    videoPara(id, sesion.user.id, esAdmin),
    videotecaPara(sesion.user.id, esAdmin),
    prisma.institutionSettings.findUnique({ where: { id: "singleton" }, select: { institutionName: true, logoUrl: true } }),
  ]);
  if (!v) notFound();
  const otros = [...todos.filter((x) => x.id !== v.id && x.categoria === v.categoria), ...todos.filter((x) => x.id !== v.id && x.categoria !== v.categoria)].slice(0, 8);

  return (
    <main className="vt" style={{ ["--vt-h" as string]: matizCategoria(v.categoria) }}>
      <CabeceraVideoteca logoUrl={ajustes?.logoUrl ?? null} institucion={ajustes?.institutionName ?? "Red Salud Casanare E.S.E."} volverA="/videos" volverTexto="Todos los videos" />
      <div className="vt-cuerpo">
        <div className="vt-ver">
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
              {v.descripcion && <p>{v.descripcion}</p>}
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
