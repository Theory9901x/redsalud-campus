import { cache } from "react";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const BELL_PAGE_SIZE = 20;

/** Filtro común: notificaciones visibles para este usuario (globales, de su rol, o dirigidas a él). */
function visibilityWhere(userId: string, role: Role) {
  return {
    OR: [{ targetType: "ALL" as const }, { targetType: "ROLE" as const, targetRole: role }, { targetUserId: userId }],
  };
}

/**
 * `cache()` deduplica esta consulta dentro de la misma petición: el header
 * (contador) y el panel de la campana la necesitan, pero solo se ejecuta una
 * vez contra la base de datos por render.
 */
export const getNotificationsForUser = cache(async (userId: string, role: Role) => {
  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: visibilityWhere(userId, role),
      orderBy: { createdAt: "desc" },
      take: BELL_PAGE_SIZE,
      include: { reads: { where: { userId }, select: { readAt: true } } },
    }),
    prisma.notification.count({
      where: { ...visibilityWhere(userId, role), reads: { none: { userId } } },
    }),
  ]);

  return {
    notifications: notifications.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      severity: n.severity,
      createdAt: n.createdAt,
      isRead: n.reads.length > 0,
    })),
    unreadCount,
  };
});

export async function markNotificationRead(notificationId: string, userId: string) {
  await prisma.notificationRead.upsert({
    where: { notificationId_userId: { notificationId, userId } },
    update: {},
    create: { notificationId, userId },
  });
}

export async function markAllNotificationsRead(userId: string, role: Role) {
  const notifications = await prisma.notification.findMany({
    where: { ...visibilityWhere(userId, role), reads: { none: { userId } } },
    select: { id: true },
  });
  if (notifications.length === 0) return;

  await prisma.notificationRead.createMany({
    data: notifications.map((n) => ({ notificationId: n.id, userId })),
    skipDuplicates: true,
  });
}
