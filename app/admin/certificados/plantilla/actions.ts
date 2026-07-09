"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { saveCertificateTemplateAsset } from "@/lib/storage";
import { DEFAULT_CERTIFICATE_LAYOUT, type CertificateLayout } from "@/lib/certificate-template";
import { certificateLayoutSchema } from "@/lib/validations/certificate-template";

export type AssetUploadState = { error: string | null; url?: string };

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

async function getOrCreateDefaultTemplate() {
  const existing = await prisma.certificateTemplate.findFirst({ where: { isDefault: true } });
  if (existing) return existing;
  return prisma.certificateTemplate.create({ data: { name: "Plantilla institucional", isDefault: true } });
}

export async function saveCertificateLayoutAction(layout: CertificateLayout): Promise<{ error: string | null }> {
  await requireAdmin();

  const parsed = certificateLayoutSchema.safeParse(layout);
  if (!parsed.success) {
    return { error: "El diseño tiene datos inválidos y no se pudo guardar. Intenta de nuevo o usa \"Restablecer\"." };
  }

  const template = await getOrCreateDefaultTemplate();

  await prisma.certificateTemplate.update({
    where: { id: template.id },
    data: { layoutJson: parsed.data as unknown as object },
  });

  revalidatePath("/admin/certificados/plantilla");
  return { error: null };
}

export async function resetCertificateLayoutAction(): Promise<{ error: string | null }> {
  await requireAdmin();
  const template = await getOrCreateDefaultTemplate();

  await prisma.certificateTemplate.update({
    where: { id: template.id },
    data: { layoutJson: DEFAULT_CERTIFICATE_LAYOUT as unknown as object },
  });

  revalidatePath("/admin/certificados/plantilla");
  return { error: null };
}

export async function uploadTemplateBackgroundAction(
  _prevState: AssetUploadState,
  formData: FormData
): Promise<AssetUploadState> {
  await requireAdmin();
  const template = await getOrCreateDefaultTemplate();

  const file = formData.get("fondo");
  if (!(file instanceof File) || file.size === 0) return { error: "Selecciona una imagen primero." };
  if (!file.type.startsWith("image/")) return { error: "El archivo debe ser una imagen." };
  if (file.size > MAX_IMAGE_SIZE) return { error: "La imagen no puede pesar más de 5 MB." };

  const url = await saveCertificateTemplateAsset(file, "fondo");
  await prisma.certificateTemplate.update({ where: { id: template.id }, data: { backgroundImageUrl: url } });

  revalidatePath("/admin/certificados/plantilla");
  return { error: null, url };
}

export async function uploadTemplateImageAction(
  _prevState: AssetUploadState,
  formData: FormData
): Promise<AssetUploadState> {
  await requireAdmin();

  const file = formData.get("imagen");
  if (!(file instanceof File) || file.size === 0) return { error: "Selecciona una imagen primero." };
  if (!file.type.startsWith("image/")) return { error: "El archivo debe ser una imagen." };
  if (file.size > MAX_IMAGE_SIZE) return { error: "La imagen no puede pesar más de 5 MB." };

  const url = await saveCertificateTemplateAsset(file, "imagen");
  return { error: null, url };
}
