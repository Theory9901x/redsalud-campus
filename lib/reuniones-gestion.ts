import { getSesionReunion } from "@/lib/reuniones";
import { prisma } from "@/lib/prisma";

const dia = (d: Date) => {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  return ["year", "month", "day"].map(type => parts.find(p => p.type === type)?.value).join("-");
};
const hora = (d: Date | null) => d ? new Intl.DateTimeFormat("en-GB", { timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d) : "";
const fecha = (d: Date | null) => d ? new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", dateStyle: "short", timeStyle: "short" }).format(d) : "";

export async function getGestionReunion(planId: string, activityId: string) {
  const d = await getSesionReunion(planId, activityId);
  if (!d) return null;
  const area = d.areaId ? { id: d.areaId } : await prisma.trainingArea.findFirst({ where: { tutorId: d.anfitrionId, isActive: true }, select: { id: true } });
  return {
    planId, activityId, titulo: d.titulo, reunion: d.reunion.titulo, objetivo: d.objetivo ?? "", desarrollo: d.desarrollo,
    ordenDelDia: d.reunion.ordenDelDia.join("\n"), compromisos: d.compromisos, responsable: d.responsable ?? "", dirigidoA: d.dirigidoA ?? "",
    cerrada: d.estado === "CLOSED", puedeGestionar: d.puedeGestionar, puedeEditarReunion: d.puedeEditarReunion,
    anfitrionAreaId: area?.id ?? "", fecha: d.jornada ? dia(d.jornada.startsAt) : "", inicio: hora(d.jornada?.startsAt ?? null), fin: hora(d.jornada?.endsAt ?? null),
    audience: d.jornada?.audience ?? "BOTH", modalidad: d.jornada?.modality ?? "VIRTUAL", lugar: d.jornada?.location ?? "",
    asistentes: d.asistentes.map(a => ({ clave: a.clave, nombre: a.nombre, cargo: a.cargo, ingreso: fecha(a.registradoEl), salida: fecha(a.salidaEl) || a.estado, minutos: a.minutos, conexiones: a.conexiones })),
    documentos: d.documentos.map(doc => ({ id: doc.id, fileName: doc.fileName, fileType: doc.fileType, fileSize: doc.fileSize, fileUrl: doc.fileUrl, kind: doc.kind, description: doc.description, fecha: fecha(doc.createdAt), uploader: doc.uploader.fullName })),
  };
}
export type GestionReunion = NonNullable<Awaited<ReturnType<typeof getGestionReunion>>>;

export function getAreasAnfitrionas() {
  return prisma.trainingArea.findMany({ where: { isActive: true, tutor: { status: "ACTIVE", role: { in: ["ADMIN", "TUTOR"] } } }, select: { id: true, name: true }, orderBy: { name: "asc" } });
}
