import { prisma } from "@/lib/prisma";
import {
  getAvanceCursos,
  getCoberturaMunicipios,
  getEmbudo,
  getIndicadores,
  getPersonas,
} from "@/lib/admin-dashboard";
import type { FiltrosPanel } from "@/lib/admin-dashboard";
import type { TipoReporte } from "@/lib/reportes-meta";

/**
 * Reportes imprimibles.
 *
 * Reutilizan EXACTAMENTE las mismas consultas que el panel en pantalla. Es la
 * decisión importante de este módulo: si el PDF tuviera sus propias consultas,
 * tarde o temprano diría un número distinto al que el administrador acaba de
 * ver, y un informe firmado que no cuadra con el panel es peor que no tener
 * informe. Aquí solo se elige QUÉ secciones entran en cada tipo.
 */

// El catálogo vive en lib/reportes-meta.ts, sin Prisma, para que también lo
// puedan importar los componentes de cliente. Se reexporta para que el lado
// servidor tenga todo en un solo sitio.
export { TIPOS_REPORTE, REPORTE_META, esTipoReporte } from "@/lib/reportes-meta";
export type { TipoReporte } from "@/lib/reportes-meta";

/** Cabecera institucional del documento: sale de configuración, no del código. */
export async function getEncabezado() {
  const ajustes = await prisma.institutionSettings.findUnique({ where: { id: "singleton" } });
  return {
    institucion: ajustes?.institutionName ?? "Red Salud Casanare E.S.E.",
    logoUrl: ajustes?.logoUrl ?? null,
    ciudad: ajustes?.city ?? "Yopal, Casanare",
    firmante: ajustes?.signerName ?? null,
    cargoFirmante: ajustes?.signerPosition ?? null,
  };
}

/**
 * Para el listado nominal se pide una sola página con tope alto en vez de
 * paginar: un informe impreso que se corta en la fila 12 no sirve de nada.
 * El tope existe igualmente para que un universo inesperadamente enorme no
 * tumbe el proceso al generar el PDF.
 */
const TOPE_NOMINAL = 2000;

export async function getDatosReporte(tipo: TipoReporte, filtros: FiltrosPanel) {
  const [encabezado, indicadores] = await Promise.all([getEncabezado(), getIndicadores(filtros)]);

  if (tipo === "cobertura") {
    return { encabezado, indicadores, cobertura: await getCoberturaMunicipios(filtros) };
  }

  if (tipo === "personal") {
    const { filas, total } = await getPersonas(filtros, 1, TOPE_NOMINAL);
    return { encabezado, indicadores, personas: filas, totalPersonas: total };
  }

  const [embudo, cobertura, cursos] = await Promise.all([
    getEmbudo(filtros),
    getCoberturaMunicipios(filtros),
    getAvanceCursos(filtros),
  ]);
  return { encabezado, indicadores, embudo, cobertura, cursos };
}

/** Describe los filtros en prosa, para que el informe diga sobre qué se hizo. */
export async function describirFiltros(filtros: FiltrosPanel): Promise<string> {
  const partes: string[] = [];

  if (filtros.municipioId) {
    const m = await prisma.municipio.findUnique({
      where: { id: filtros.municipioId },
      select: { nombre: true },
    });
    if (m) partes.push(`municipio de ${m.nombre}`);
  }
  if (filtros.personnelType) {
    partes.push(`personal ${filtros.personnelType === "ASISTENCIAL" ? "asistencial" : "administrativo"}`);
  }
  if (filtros.courseId) {
    const c = await prisma.course.findUnique({ where: { id: filtros.courseId }, select: { title: true } });
    if (c) partes.push(`curso «${c.title}»`);
  }

  return partes.length > 0 ? `Filtrado por ${partes.join(", ")}.` : "Sin filtros: toda la institución.";
}
