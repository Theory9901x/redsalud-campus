"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { regenerateCertificatePdf } from "@/lib/certificates";

export type RevokeCertificateState = { error: string | null; success?: boolean };

export async function revokeCertificateAction(
  certificateId: string,
  _prevState: RevokeCertificateState,
  formData: FormData
): Promise<RevokeCertificateState> {
  await requireAdmin();

  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) {
    return { error: "Escribe el motivo de la anulación." };
  }

  await prisma.certificate.update({
    where: { id: certificateId },
    data: { status: "REVOKED", revokedAt: new Date(), revokedReason: reason },
  });

  revalidatePath("/admin/certificados");
  return { error: null, success: true };
}

export async function restoreCertificateAction(certificateId: string) {
  await requireAdmin();
  await prisma.certificate.update({
    where: { id: certificateId },
    data: { status: "VALID", revokedAt: null, revokedReason: null },
  });
  revalidatePath("/admin/certificados");
}

export async function regenerateCertificateAction(certificateId: string) {
  await requireAdmin();
  await regenerateCertificatePdf(certificateId);
  revalidatePath("/admin/certificados");
}
