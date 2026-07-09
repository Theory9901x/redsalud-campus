"use client";

import { useState, useTransition } from "react";
import { Bell, CheckCheck } from "lucide-react";
import type { NotificationSeverity } from "@prisma/client";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { markNotificationReadAction, markAllNotificationsReadAction } from "@/lib/notification-actions";
import { cn } from "@/lib/utils";

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  severity: NotificationSeverity;
  createdAt: Date;
  isRead: boolean;
};

const SEVERITY_DOT: Record<NotificationSeverity, string> = {
  INFO: "bg-primary",
  SUCCESS: "bg-success",
  WARNING: "bg-warning",
  DANGER: "bg-destructive",
};

export function NotificationBell({
  notifications,
  unreadCount,
}: {
  notifications: NotificationItem[];
  unreadCount: number;
}) {
  const [items, setItems] = useState(notifications);
  const [unread, setUnread] = useState(unreadCount);
  const [, startTransition] = useTransition();

  function handleOpenNotification(id: string) {
    const target = items.find((n) => n.id === id);
    if (!target || target.isRead) return;

    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    setUnread((prev) => Math.max(0, prev - 1));
    startTransition(() => {
      markNotificationReadAction(id);
    });
  }

  function handleMarkAllRead() {
    if (unread === 0) return;
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnread(0);
    startTransition(() => {
      markAllNotificationsReadAction();
    });
  }

  return (
    <Popover>
      <PopoverTrigger className="relative flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground">
        <Bell className="h-5 w-5" strokeWidth={2} />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-[calc(100vw-2rem)] max-w-sm sm:w-96">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="font-display text-sm font-bold text-foreground">Notificaciones</p>
          {unread > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Marcar todas
            </button>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <Bell className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No tienes notificaciones.</p>
            </div>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => handleOpenNotification(n.id)}
                className={cn(
                  "flex w-full items-start gap-3 border-b border-border/60 px-4 py-3 text-left transition-colors last:border-0 hover:bg-muted",
                  !n.isRead && "bg-primary/[0.04]"
                )}
              >
                <span
                  className={cn(
                    "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                    n.isRead ? "bg-transparent" : SEVERITY_DOT[n.severity]
                  )}
                />
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className={cn("text-sm", n.isRead ? "font-medium text-foreground/80" : "font-semibold text-foreground")}>
                    {n.title}
                  </p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
                  <p className="text-[11px] text-muted-foreground/70">
                    {n.createdAt.toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
