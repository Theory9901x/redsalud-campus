import { prisma } from "@/lib/prisma";

export type VideoLista = {
  id: string;
  titulo: string;
  descripcion: string | null;
  categoria: string | null;
  duracionSeg: number | null;
  conPortada: boolean;
  estado: string;
  publicado: boolean;
  creado: Date;
  /** Avance de quien mira: 0–1, y si lo completó. */
  avance: number;
  completado: boolean;
};

const SELECT = {
  id: true,
  titulo: true,
  descripcion: true,
  categoria: true,
  duracionSeg: true,
  portada: true,
  estado: true,
  publicado: true,
  createdAt: true,
} as const;

function aLista(v: { id: string; titulo: string; descripcion: string | null; categoria: string | null; duracionSeg: number | null; portada: string | null; estado: string; publicado: boolean; createdAt: Date }, vista?: { segundos: number; completado: boolean } | null): VideoLista {
  const dur = v.duracionSeg ?? 0;
  return {
    id: v.id,
    titulo: v.titulo,
    descripcion: v.descripcion,
    categoria: v.categoria,
    duracionSeg: v.duracionSeg,
    conPortada: !!v.portada,
    estado: v.estado,
    publicado: v.publicado,
    creado: v.createdAt,
    avance: vista?.completado ? 1 : dur > 0 && vista ? Math.min(1, vista.segundos / dur) : 0,
    completado: !!vista?.completado,
  };
}

/** La videoteca de una persona: publicados (y los ocultos si es admin), con su avance. */
export async function videotecaPara(userId: string, incluirOcultos: boolean) {
  const videos = await prisma.videoCapacitacion.findMany({
    where: incluirOcultos ? {} : { publicado: true },
    orderBy: { createdAt: "desc" },
    select: { ...SELECT, vistas: { where: { userId }, select: { segundos: true, completado: true } } },
  });
  return videos.map((v) => aLista(v, v.vistas[0]));
}

export async function videoPara(id: string, userId: string, incluirOcultos: boolean) {
  const v = await prisma.videoCapacitacion.findUnique({
    where: { id },
    select: { ...SELECT, media: { select: { fileUrl: true, fileType: true } }, vistas: { where: { userId }, select: { segundos: true, posicion: true, completado: true } } },
  });
  if (!v || (!v.publicado && !incluirOcultos)) return null;
  const vista = v.vistas[0] ?? null;
  return { ...aLista(v, vista), src: v.media.fileUrl, tipo: v.media.fileType, posicion: vista?.posicion ?? 0 };
}

/** Panel de gestión: cada video con su archivo y quién lo ha visto. */
export async function videosAdmin() {
  const videos = await prisma.videoCapacitacion.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      ...SELECT,
      media: { select: { fileSize: true } },
      vistas: {
        orderBy: { ultimaVez: "desc" },
        select: { segundos: true, completado: true, ultimaVez: true, user: { select: { fullName: true, department: true, position: true } } },
      },
    },
  });
  return videos.map((v) => ({
    ...aLista(v),
    tamano: v.media.fileSize,
    personas: v.vistas.length,
    completos: v.vistas.filter((x) => x.completado).length,
    vistas: v.vistas.map((x) => ({
      nombre: x.user.fullName,
      area: x.user.department ?? x.user.position ?? null,
      avance: x.completado ? 1 : v.duracionSeg ? Math.min(1, x.segundos / v.duracionSeg) : 0,
      completado: x.completado,
      ultimaVez: x.ultimaVez,
    })),
  }));
}

export type VideoAdmin = Awaited<ReturnType<typeof videosAdmin>>[number];

/** El video más reciente de una categoría (p. ej. el tutorial de SIAU). */
export function ultimoVideoDe(categoria: string) {
  return prisma.videoCapacitacion.findFirst({
    where: { publicado: true, categoria: { equals: categoria, mode: "insensitive" } },
    orderBy: { createdAt: "desc" },
    select: { id: true, titulo: true, duracionSeg: true },
  });
}

export { duracionTexto } from "@/lib/videoteca/formato";
