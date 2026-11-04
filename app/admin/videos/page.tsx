import Link from "next/link";
import { redirect } from "next/navigation";
import { Clapperboard, ExternalLink } from "lucide-react";
import { auth } from "@/auth";
import { esSoloLectura, veComoAdmin } from "@/lib/roles";
import { videosAdmin } from "@/lib/videoteca/consultas";
import { SubirVideo } from "@/components/videoteca/subir-video";
import { ListaVideosAdmin } from "@/components/videoteca/lista-admin";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Videos de capacitación" };

/**
 * GESTIÓN DE LA VIDEOTECA: subir videos de capacitación, editarlos,
 * ocultarlos y ver quién los ha visto y hasta dónde. El personal los ve en
 * /videos.
 */
export default async function AdminVideosPage() {
  const sesion = await auth();
  if (!sesion?.user || !veComoAdmin(sesion.user.role) || (sesion.user.restrictedAdminSections ?? []).includes("CURSOS")) redirect("/no-autorizado");
  const soloLectura = esSoloLectura(sesion.user.role);
  const videos = await videosAdmin();
  const categorias = [...new Set(videos.map((v) => v.categoria).filter((c): c is string => !!c))];
  const personas = new Set(videos.flatMap((v) => v.vistas.map((x) => x.nombre))).size;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="inline-flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            <Clapperboard className="h-3.5 w-3.5" aria-hidden="true" />
            Videoteca
          </p>
          <h1 className="mt-1 text-[clamp(1.4rem,1.1rem+1vw,1.9rem)] font-extrabold tracking-[-0.02em]">Videos de capacitación</h1>
          <p className="mt-1 max-w-[62ch] text-[13.5px] text-muted-foreground">
            Lo que subas aquí lo ve todo el personal con su cuenta, en el celular o el computador, en <b className="text-foreground">/videos</b>. No se descarga ni pasa por Drive. Cada video registra quién lo abrió y si lo terminó.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-border bg-card px-3 py-1 text-[12.5px] font-semibold">
            {videos.length} {videos.length === 1 ? "video" : "videos"} · {personas} {personas === 1 ? "persona" : "personas"} los han visto
          </span>
          <Link href="/videos" target="_blank" className={cn(buttonVariants({ size: "sm", variant: "outline" }), "gap-1.5")}>
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            Abrir la videoteca
          </Link>
        </div>
      </header>

      {!soloLectura && <SubirVideo categorias={categorias} />}
      <ListaVideosAdmin videos={videos} soloLectura={soloLectura} />
    </div>
  );
}
