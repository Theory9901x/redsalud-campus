"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/audit";
import { gestorVideoteca } from "@/lib/videoteca/acceso";
import { borrarArchivos, optimizar } from "@/lib/videoteca/almacen";

type Resultado = { ok: true } | { ok: false; error: string };

function revalidar(id?: string) {
  revalidatePath("/admin/videos");
  revalidatePath("/videos");
  if (id) revalidatePath(`/videos/${id}`);
}

export async function actualizarVideo(id: string, datos: { titulo: string; descripcion: string; categoria: string; publicado: boolean; publico: boolean }): Promise<Resultado> {
  const sesion = await gestorVideoteca();
  if (!sesion) return { ok: false, error: "No autorizado." };
  const titulo = datos.titulo.trim().slice(0, 160);
  if (!titulo) return { ok: false, error: "El título no puede quedar vacío." };
  await prisma.videoCapacitacion.update({
    where: { id },
    data: {
      titulo,
      descripcion: datos.descripcion.trim().slice(0, 2000) || null,
      categoria: datos.categoria.trim().slice(0, 60) || null,
      publicado: datos.publicado,
      publico: datos.publico,
    },
  });
  await registrarAuditoria({ userId: sesion.user.id, action: "UPDATE", entity: "Video", entityId: id, description: `Video actualizado: «${titulo}»${datos.publicado ? "" : " (oculto)"}` });
  revalidar(id);
  return { ok: true };
}

export async function publicarVideo(id: string, publicado: boolean): Promise<Resultado> {
  const sesion = await gestorVideoteca();
  if (!sesion) return { ok: false, error: "No autorizado." };
  const v = await prisma.videoCapacitacion.update({ where: { id }, data: { publicado }, select: { titulo: true } });
  await registrarAuditoria({ userId: sesion.user.id, action: "UPDATE", entity: "Video", entityId: id, description: `Video ${publicado ? "publicado" : "ocultado"}: «${v.titulo}»` });
  revalidar(id);
  return { ok: true };
}

export async function eliminarVideo(id: string): Promise<Resultado> {
  const sesion = await gestorVideoteca();
  if (!sesion) return { ok: false, error: "No autorizado." };
  const v = await prisma.videoCapacitacion.findUnique({ where: { id }, select: { titulo: true, portada: true, mediaId: true, media: { select: { fileName: true } } } });
  if (!v) return { ok: false, error: "El video ya no existe." };
  // Borrar el Media arrastra el video y sus vistas (cascada).
  await prisma.media.delete({ where: { id: v.mediaId } });
  await borrarArchivos(v.media.fileName, v.portada).catch(() => {});
  await registrarAuditoria({ userId: sesion.user.id, action: "DELETE", entity: "Video", entityId: id, description: `Video eliminado: «${v.titulo}»` });
  revalidar();
  return { ok: true };
}

/** Vuelve a generar portada y versión para celular (si quedó en error o a medias). */
export async function reprocesarVideo(id: string): Promise<Resultado> {
  const sesion = await gestorVideoteca();
  if (!sesion) return { ok: false, error: "No autorizado." };
  await prisma.videoCapacitacion.update({ where: { id }, data: { estado: "PROCESANDO" } });
  void optimizar(id).catch(() => {});
  revalidar(id);
  return { ok: true };
}
