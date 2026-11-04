import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { esSoloLectura, veComoAdmin } from "@/lib/roles";
import { CabeceraGalardones } from "@/components/galardones/escena";
import { TableroResultados } from "@/components/galardones/tablero-resultados";
import { estadoConvocatoria, resultadosGalardones } from "@/lib/galardones/consultas";
import { NOMBRE_RECONOCIMIENTO } from "@/lib/galardones/valores";

/**
 * RESULTADOS de la Noche de Galardones, para Talento Humano: por centro IPS
 * y por valor, quién lleva más postulaciones. Aquí también se fusionan o
 * separan candidatos cuando la agrupación automática de nombres se
 * equivoca, y se abre o cierra la convocatoria.
 */
export default async function ResultadosGalardonesPage() {
  const sesion = await requireSession("/galardones/resultados");
  if (!veComoAdmin(sesion.user.role)) redirect("/no-autorizado");
  if (sesion.user.role === "ADMIN" && (sesion.user.restrictedAdminSections ?? []).includes("USUARIOS")) redirect("/no-autorizado");

  const [ajustes, convocatoria, resultados] = await Promise.all([
    prisma.institutionSettings.findUnique({ where: { id: "singleton" }, select: { institutionName: true, logoUrl: true } }),
    estadoConvocatoria(),
    resultadosGalardones(),
  ]);

  return (
    <main className="gala-lienzo">
      <CabeceraGalardones
        logoUrl={ajustes?.logoUrl ?? null}
        institucion={ajustes?.institutionName ?? "Red Salud Casanare E.S.E."}
        volverA="/admin"
        volverTexto="Panel administrativo"
        anio={convocatoria.anio}
      />
      <section>
        <span className="gala-eyebrow">Resultados · por centro IPS y por valor</span>
        <h1 className="gala-titulo">
          <span className="brillo">{NOMBRE_RECONOCIMIENTO}</span>
        </h1>
        <p className="gala-lead">
          Cada postulación suma a una persona aunque su nombre se haya escrito distinto. Si la agrupación automática juntó o separó mal a alguien, corrígelo desde
          cada candidato: los resultados se recalculan al instante.
        </p>
      </section>
      <TableroResultados
        resultados={resultados}
        convocatoria={{ abierta: convocatoria.abierta, cierraEl: convocatoria.cierraEl ? convocatoria.cierraEl.toISOString() : null }}
        soloLectura={esSoloLectura(sesion.user.role)}
      />
    </main>
  );
}
