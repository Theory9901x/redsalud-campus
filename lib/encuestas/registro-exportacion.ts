import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/audit";
import { rangoDePeriodo, type Periodo } from "@/lib/encuestas/metrics";

export type TipoExportacion = "informe-pdf" | "siho-xlsx" | "datos-xlsx";

/**
 * TRAZABILIDAD de exportaciones SIAU: cada descarga queda en la bitácora
 * (quién, cuándo, qué tipo, qué periodo y filtros). Sin tabla nueva: la
 * bitácora institucional ya existe para esto.
 */
export async function registrarExportacionSiau(userId: string, tipo: TipoExportacion, periodo: Periodo, filtros: Record<string, string | undefined> = {}) {
  const rango = rangoDePeriodo(periodo);
  const extra = Object.entries(filtros).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join(", ");
  await registrarAuditoria({
    userId,
    action: "EXPORT",
    entity: "Survey",
    entityId: `siau:${tipo}:${rango.clave}`,
    description: `Exportó ${ETIQUETA_TIPO[tipo]} de la encuesta SIAU · ${rango.etiqueta}${extra ? ` · ${extra}` : ""}`,
  });
}

export const ETIQUETA_TIPO: Record<TipoExportacion, string> = {
  "informe-pdf": "informe general (PDF)",
  "siho-xlsx": "Excel SIHO",
  "datos-xlsx": "datos crudos (Excel)",
};

/** Últimas exportaciones registradas, para mostrarlas junto al panel. */
export async function ultimasExportacionesSiau(limite = 8) {
  return prisma.auditLog.findMany({
    where: { action: "EXPORT", entity: "Survey", entityId: { startsWith: "siau:" } },
    orderBy: { createdAt: "desc" },
    take: limite,
    select: { id: true, createdAt: true, description: true, user: { select: { fullName: true } } },
  });
}
