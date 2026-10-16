import { notFound } from "next/navigation";
import { requireTutorOrAdmin } from "@/lib/auth-helpers";
import { getInformeSiau, getEstructuraSiau } from "@/lib/encuestas/metrics";
import { leerPeriodo, periodoActual } from "@/lib/encuestas/periodo-url";
import { leerConfig } from "@/lib/encuestas/tipos";
import { ultimasExportacionesSiau } from "@/lib/encuestas/registro-exportacion";
import { VistaSiau } from "@/components/encuestas/siau/vista-siau";

/**
 * CENTRO DE DATOS SIAU: informe general de la Encuesta de Atención al
 * Usuario por periodo, con filtros combinables, tendencia, comparativo,
 * ranking de sedes, detalle por pregunta, cruces por variable, sugerencias
 * y la estación única de exportación. Aquí solo se consultan los datos; la
 * presentación vive en components/encuestas/siau/vista-siau.tsx.
 */
export default async function CentroDatosSiauPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireTutorOrAdmin();
  const sp = await searchParams;
  const params = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
  const periodo = leerPeriodo(params) ?? periodoActual((sp.tipo as "mensual" | "trimestral" | "anual") || "mensual");
  const filtros = { sede: sp.sede || undefined, servicio: sp.servicio || undefined, sexo: sp.sexo || undefined, eps: sp.eps || undefined };

  const [informe, estructura, exportaciones] = await Promise.all([getInformeSiau(periodo, filtros), getEstructuraSiau(), ultimasExportacionesSiau(8)]);
  if (!informe || !estructura) notFound();
  const encuesta = estructura.encuesta;
  const opcionesDe = (rol?: string, estilo?: string) => encuesta.pages.flatMap((p) => p.questions).find((q) => (rol && leerConfig(q.config).rol === rol) || (estilo && leerConfig(q.config).estilo === estilo));

  return (
    <VistaSiau
      informe={informe}
      encuesta={{ id: encuesta.id, code: encuesta.code, title: encuesta.title, slug: encuesta.slug }}
      opciones={{
        sedes: leerConfig(opcionesDe("municipio")?.config).opciones?.map((o) => o.texto) ?? [],
        servicios: leerConfig(opcionesDe(undefined, "servicios")?.config).opciones?.map((o) => o.texto) ?? [],
        eps: leerConfig(opcionesDe("eps")?.config).opciones?.map((o) => o.texto) ?? [],
      }}
      periodo={periodo}
      filtros={filtros}
      consulta={params.toString()}
      exportaciones={exportaciones}
    />
  );
}
