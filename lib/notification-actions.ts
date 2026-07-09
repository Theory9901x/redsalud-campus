"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { markNotificationRead, markAllNotificationsRead } from "@/lib/notifications";

export async function markNotificationReadAction(notificationId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado.");

  await markNotificationRead(notificationId, session.user.id);
  revalidatePath("/", "layout");
}

export async function markAllNotificationsReadAction() {
  const session = await auth();
  if (!session?.user) throw new Error("No autenticado.");

  await markAllNotificationsRead(session.user.id, session.user.role);
  revalidatePath("/", "layout");
}
