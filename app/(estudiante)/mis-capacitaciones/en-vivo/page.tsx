import { requireSession } from "@/lib/auth-helpers";
import { veComoAdmin } from "@/lib/roles";
import { getCapacitacionesEnVivo } from "@/lib/en-vivo";
import { VistaEnVivo } from "@/components/en-vivo/vista-en-vivo";
import { PestanasCapacitaciones } from "@/components/en-vivo/pestanas-capacitaciones";

export const dynamic = "force-dynamic";

/** Mis capacitaciones · En vivo: las llamadas vigentes y las próximas, para entrar directo. */
export default async function EnVivoPage() {
  const session = await requireSession("/mis-capacitaciones/en-vivo");
  const fichas = await getCapacitacionesEnVivo({ viewer: session.user, verPruebas: veComoAdmin(session.user.role) || session.user.role === "TUTOR" });
  return (
    <main className="canvas-formacion min-h-full flex-1">
      <div className="mx-auto w-full max-w-[1480px] px-4 py-8 sm:px-6 lg:px-8">
        <VistaEnVivo
          fichas={fichas}
          pestanas={<PestanasCapacitaciones activa="en-vivo" enVivo={fichas.filter((f) => f.estado === "EN_VIVO").length} />}
        />
      </div>
    </main>
  );
}
