import { prisma } from "@/lib/prisma";
import { getCallConnectionSummaryForActivity } from "@/lib/call-connections";

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

/**
 * El nombre guardado lleva el prefijo de tiempo y los guiones que necesita el
 * disco ("1787699533394-Grabacion-jornada-2026-08-25-23h12.webm"). Para un
 * documento que se radica ante un ente de control eso no se lee: aquí se
 * devuelve el nombre en limpio, sin tocar el archivo.
 */
function nombreLegible(fileName: string): string {
  return fileName
    .replace(/^\d{10,}-/, "")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/-/g, " ")
    .trim();
}

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
      nombre: nombreLegible(d.fileName),
      tipo: d.fileType,
      tamanoMB: Math.round((d.fileSize / (1024 * 1024)) * 10) / 10,
      subidoEl: d.createdAt,
      esGrabacion: d.fileType.startsWith("video/"),
    })),
    conexion,
  };
}
