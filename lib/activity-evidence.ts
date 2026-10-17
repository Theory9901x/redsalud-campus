import { prisma } from "@/lib/prisma";
import { getCallConnectionSummaryForActivity } from "@/lib/call-connections";
import { nombreLegibleDocumento } from "@/lib/documentos";

/**
 * EVIDENCIAS DE LA JORNADA para el informe: los archivos adjuntos (grabación
 * de la sesión, listados, soportes) y el tiempo que el personal estuvo
 * realmente conectado a la videollamada.
 *
 * Se leen EN VIVO y a propósito no viajan en el informe congelado: el acta
 * congela las CIFRAS -adherencia, asistencia, resultados-, que no deben
 * cambiar retroactivamente, pero una evidencia se adjunta justo después de
 * cerrar (la grabación se sube cuando termina la jornada, no antes). Si
 * fueran parte del congelado, el informe nunca podría mostrar la grabación
 * de su propia jornada.
 */
export type EvidenciaJornada = {
  documentos: { nombre: string; tipo: string; tamanoMB: number; subidoEl: Date; esGrabacion: boolean }[];
  conexion: { tramos: number; personas: number; minutosTotales: number; minutosPromedio: number };
};

export async function getActivityEvidence(activityId: string): Promise<EvidenciaJornada> {
  const [documentos, conexion] = await Promise.all([
    prisma.media.findMany({
      where: { trainingActivityId: activityId },
      select: { fileName: true, fileType: true, fileSize: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    getCallConnectionSummaryForActivity(activityId),
  ]);

  return {
    documentos: documentos.map((d) => ({
      nombre: nombreLegibleDocumento(d.fileName),
      tipo: d.fileType,
      tamanoMB: Math.round((d.fileSize / (1024 * 1024)) * 10) / 10,
      subidoEl: d.createdAt,
      esGrabacion: d.fileType.startsWith("video/"),
    })),
    conexion,
  };
}
