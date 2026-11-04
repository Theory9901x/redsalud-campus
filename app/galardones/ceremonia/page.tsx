import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Fraunces } from "next/font/google";
import "./ceremonia.css";
import { requireSession } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { veComoAdmin } from "@/lib/roles";
import { estadoConvocatoria, ganadoresGalardones } from "@/lib/galardones/consultas";
import { CeremoniaGalardones } from "@/components/galardones/ceremonia";

const gala = Fraunces({ subsets: ["latin"], variable: "--font-gala", style: ["normal", "italic"], axes: ["opsz"], display: "swap" });

export const metadata: Metadata = { title: "Ceremonia · Galardones" };
export const dynamic = "force-dynamic";

/**
 * CEREMONIA: pantalla para proyectar los ganadores. Solo administración
 * (los resultados son reservados hasta el evento). Los datos se leen al
 * abrir, así que refleja las fusiones y validaciones hechas hasta ese momento.
 */
export default async function CeremoniaPage() {
  const sesion = await requireSession("/galardones/ceremonia");
  if (!veComoAdmin(sesion.user.role)) redirect("/no-autorizado");
  if (sesion.user.role === "ADMIN" && (sesion.user.restrictedAdminSections ?? []).includes("USUARIOS")) redirect("/no-autorizado");

  const [centros, convocatoria, ajustes] = await Promise.all([
    ganadoresGalardones(),
    estadoConvocatoria(),
    prisma.institutionSettings.findUnique({ where: { id: "singleton" }, select: { institutionName: true, logoUrl: true } }),
  ]);

  return (
    <div className={gala.variable}>
      <CeremoniaGalardones
        centros={centros}
        anio={convocatoria.anio}
        institucion={ajustes?.institutionName ?? "Red Salud Casanare E.S.E."}
        logoUrl={ajustes?.logoUrl ?? null}
        salirA="/admin/galardones"
      />
    </div>
  );
}
