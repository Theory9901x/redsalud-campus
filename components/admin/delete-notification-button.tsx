"use client";

import { Trash2 } from "lucide-react";
import { deleteNotificationAction } from "@/app/admin/notificaciones/actions";

export function DeleteNotificationButton({ notificationId }: { notificationId: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        if (confirm("¿Eliminar esta notificación? Dejará de verse en la campana de sus destinatarios.")) {
          deleteNotificationAction(notificationId);
        }
      }}
      className="text-muted-foreground transition-colors hover:text-destructive"
      aria-label="Eliminar notificación"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
