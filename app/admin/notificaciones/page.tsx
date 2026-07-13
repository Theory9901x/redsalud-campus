import { Bell } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { NotificationForm } from "@/components/admin/notification-form";
import { DeleteNotificationButton } from "@/components/admin/delete-notification-button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/brand/empty-state";
import { AdminPageHeader } from "@/components/admin/page-header";
import type { NotificationSeverity } from "@prisma/client";

const SEVERITY_LABELS: Record<NotificationSeverity, string> = {
  INFO: "Informativa",
  SUCCESS: "Buena noticia",
  WARNING: "Advertencia",
  DANGER: "Urgente",
};

const SEVERITY_CLASSES: Record<NotificationSeverity, string> = {
  INFO: "bg-primary/10 text-primary",
  SUCCESS: "bg-success/10 text-success",
  WARNING: "bg-warning/15 text-warning-foreground",
  DANGER: "bg-destructive/10 text-destructive",
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administradores",
  TUTOR: "Tutores",
  STUDENT: "Estudiantes",
};

export default async function NotificacionesPage() {
  const [notifications, users] = await Promise.all([
    prisma.notification.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        targetUser: { select: { fullName: true } },
        _count: { select: { reads: true } },
      },
    }),
    prisma.user.findMany({
      where: { status: "ACTIVE" },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, email: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Notificaciones"
        description="Emite novedades institucionales a todos los usuarios, a un rol, o a una persona puntual."
      />

      <NotificationForm users={users} />

      <div className="space-y-3">
        <h2 className="font-display text-lg font-bold text-foreground">Enviadas recientemente</h2>

        {notifications.length === 0 ? (
          <EmptyState icon={Bell} title="Aún no has enviado notificaciones" description="Las que emitas aparecerán aquí." />
        ) : (
          <div className="surface divide-y divide-border overflow-hidden">
            {notifications.map((n) => (
              <div key={n.id} className="flex items-start justify-between gap-4 p-4">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-foreground">{n.title}</p>
                    <Badge className={SEVERITY_CLASSES[n.severity]}>{SEVERITY_LABELS[n.severity]}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{n.body}</p>
                  <p className="text-xs text-muted-foreground/70">
                    {n.targetType === "ALL" && "Todos los usuarios"}
                    {n.targetType === "ROLE" && n.targetRole && ROLE_LABELS[n.targetRole]}
                    {n.targetType === "USER" && `Solo ${n.targetUser?.fullName ?? "usuario eliminado"}`}
                    {" · "}
                    {n.createdAt.toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })}
                    {" · "}
                    {n._count.reads} {n._count.reads === 1 ? "lectura" : "lecturas"}
                  </p>
                </div>
                <DeleteNotificationButton notificationId={n.id} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
