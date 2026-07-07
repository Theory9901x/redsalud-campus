import { cache } from "react";
import { prisma } from "@/lib/prisma";

/**
 * Devuelve la URL del avatar más reciente del usuario, sin necesidad de una
 * columna dedicada en User: se guarda como un Media normal en la carpeta
 * "avatars/{userId}" y se busca el más reciente.
 *
 * `cache()` deduplica la consulta dentro de la misma petición: el layout del
 * estudiante y /perfil la llaman por separado, pero solo pega a la BD una vez.
 */
export const getUserAvatarUrl = cache(async (userId: string): Promise<string | null> => {
  const media = await prisma.media.findFirst({
    where: { folder: `avatars/${userId}` },
    orderBy: { createdAt: "desc" },
  });
  return media?.fileUrl ?? null;
});
