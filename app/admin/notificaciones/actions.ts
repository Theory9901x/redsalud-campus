"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { createNotificationSchema } from "@/lib/validations/notification";

export type NotificationFormState = {
  error: string | null;
  success?: boolean;
};

export async function createNotificationAction(
  _prevState: NotificationFormState,
  formData: FormData
): Promise<NotificationFormState> {
  const session = await requireAdmin();

  const parsed = createNotificationSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
    severity: formData.get("severity"),
    targetType: formData.get("targetType"),
    targetRole: formData.get("targetRole") ?? "",
    targetUserId: formData.get("targetUserId") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const data = parsed.data;

  await prisma.notification.create({
    data: {
      title: data.title,
      body: data.body,
      severity: data.severity,
      targetType: data.targetType,
      targetRole: data.targetType === "ROLE" ? (data.targetRole as "ADMIN" | "TUTOR" | "STUDENT") : null,
      targetUserId: data.targetType === "USER" ? data.targetUserId || null : null,
      createdById: session.user.id,
    },
  });

  revalidatePath("/admin/notificaciones");
  revalidatePath("/", "layout");
  return { error: null, success: true };
}

export async function deleteNotificationAction(notificationId: string) {
  await requireAdmin();
  await prisma.notification.delete({ where: { id: notificationId } });
  revalidatePath("/admin/notificaciones");
  revalidatePath("/", "layout");
}
