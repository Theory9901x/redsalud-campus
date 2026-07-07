"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { institutionSettingsSchema } from "@/lib/validations/settings";
import { saveInstitutionAsset } from "@/lib/storage";

export type SettingsFormState = { error: string | null; success?: boolean };
export type AssetUploadState = { error: string | null };

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

async function ensureSettingsRow() {
  return prisma.institutionSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
}

export async function updateInstitutionSettingsAction(
  _prevState: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  await requireAdmin();
  await ensureSettingsRow();

  const parsed = institutionSettingsSchema.safeParse({
    institutionName: formData.get("institutionName"),
    contactEmail: formData.get("contactEmail") ?? "",
    contactPhone: formData.get("contactPhone") ?? "",
    city: formData.get("city"),
    certificateText: formData.get("certificateText") ?? "",
    signerName: formData.get("signerName") ?? "",
    signerPosition: formData.get("signerPosition") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const data = parsed.data;

  await prisma.institutionSettings.update({
    where: { id: "singleton" },
    data: {
      institutionName: data.institutionName,
      contactEmail: data.contactEmail || null,
      contactPhone: data.contactPhone || null,
      city: data.city,
      certificateText: data.certificateText || null,
      signerName: data.signerName || null,
      signerPosition: data.signerPosition || null,
    },
  });

  revalidatePath("/admin/configuracion");
  return { error: null, success: true };
}

export async function uploadInstitutionLogoAction(
  _prevState: AssetUploadState,
  formData: FormData
): Promise<AssetUploadState> {
  await requireAdmin();
  await ensureSettingsRow();

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) return { error: "Selecciona una imagen primero." };
  if (!file.type.startsWith("image/")) return { error: "El archivo debe ser una imagen." };
  if (file.size > MAX_IMAGE_SIZE) return { error: "La imagen no puede pesar más de 5 MB." };

  try {
    const logoUrl = await saveInstitutionAsset(file, "logo");
    await prisma.institutionSettings.update({ where: { id: "singleton" }, data: { logoUrl } });
  } catch (error) {
    console.error("Error subiendo el logo institucional:", error);
    return { error: "No se pudo guardar el logo. Intenta de nuevo." };
  }

  revalidatePath("/admin/configuracion");
  return { error: null };
}

export async function uploadInstitutionSignatureAction(
  _prevState: AssetUploadState,
  formData: FormData
): Promise<AssetUploadState> {
  await requireAdmin();
  await ensureSettingsRow();

  const file = formData.get("firma");
  if (!(file instanceof File) || file.size === 0) return { error: "Selecciona una imagen primero." };
  if (!file.type.startsWith("image/")) return { error: "El archivo debe ser una imagen." };
  if (file.size > MAX_IMAGE_SIZE) return { error: "La imagen no puede pesar más de 5 MB." };

  try {
    const signatureUrl = await saveInstitutionAsset(file, "firma");
    await prisma.institutionSettings.update({ where: { id: "singleton" }, data: { signatureUrl } });
  } catch (error) {
    console.error("Error subiendo la firma institucional:", error);
    return { error: "No se pudo guardar la firma. Intenta de nuevo." };
  }

  revalidatePath("/admin/configuracion");
  return { error: null };
}
