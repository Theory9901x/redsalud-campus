import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { publicUploadDiskPath } from "@/lib/storage";
import { renderDocumentoActa } from "@/lib/acta-reunion-documento";
import type { SesionReunion } from "@/lib/reuniones";

export async function renderActaReunionPdf(d: SesionReunion, generadoPor: string): Promise<{ buffer: Buffer; codigo: string }> {
  const ajustes = await prisma.institutionSettings.findUnique({ where: { id: "singleton" }, select: { logoUrl: true, institutionName: true } });
  let logo: string | null = null;
  if (ajustes?.logoUrl) {
    try {
      const png = await sharp(await readFile(publicUploadDiskPath(ajustes.logoUrl))).resize(160, 160, { fit: "inside" }).png().toBuffer();
      logo = `data:image/png;base64,${png.toString("base64")}`;
    } catch {
      /* sin logo */
    }
  }
  const anio = Number(new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "America/Bogota" }).format(d.jornada?.startsAt ?? new Date()));
  const codigo = `ACT-${anio}-${d.id.slice(-6).toUpperCase()}`;
  const buffer = await renderDocumentoActa({ d, codigo, logo, institucion: ajustes?.institutionName ?? "Red Salud Casanare E.S.E.", generadoPor });
  return { buffer, codigo };
}
