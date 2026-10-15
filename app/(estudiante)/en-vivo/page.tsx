import { Radio } from "lucide-react";
import { requireSession } from "@/lib/auth-helpers";
import { veComoAdmin } from "@/lib/roles";
import { getCapacitacionesEnVivo } from "@/lib/en-vivo";
import { ModuloHero } from "@/components/training-plans/modulo-hero";
import { PanelEnVivo } from "@/components/en-vivo/panel-en-vivo";

export const dynamic = "force-dynamic";

/** Capacitaciones EN VIVO: todas las llamadas vigentes y las próximas, para entrar directo. */
export default async function EnVivoPage() {
  const session = await requireSession("/en-vivo");
  const fichas = await getCapacitacionesEnVivo({ verPruebas: veComoAdmin(session.user.role) || session.user.role === "TUTOR" });
  const enVivo = fichas.filter((f) => f.estado === "EN_VIVO");

  return (
    <main className="canvas-formacion min-h-full flex-1">
      <div className="mx-auto w-full max-w-[1480px] space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <ModuloHero
        eyebrow="Sala en vivo"
        Icono={Radio}
        titulo="Capacitaciones"
        acento="en vivo"
        descripcion="Las llamadas que están ocurriendo ahora en la institución. No necesitas que te envíen el enlace ni el QR: busca la tuya y entra."
        cifras={[
          { valor: enVivo.length, etiqueta: "En vivo ahora" },
          { valor: enVivo.reduce((s, f) => s + f.conectados, 0), etiqueta: "Personas conectadas" },
          { valor: fichas.length - enVivo.length, etiqueta: "Próximas", detalle: "en 7 días" },
          { valor: new Set(enVivo.map((f) => f.area ?? "—")).size, etiqueta: "Áreas en vivo" },
        ]}
      />
      <PanelEnVivo
        fichas={fichas.map((f) => ({ ...f, inicio: f.inicio?.toISOString() ?? null, fin: f.fin?.toISOString() ?? null }))}
      />
      </div>
    </main>
  );
}
