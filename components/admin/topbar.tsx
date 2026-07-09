"use client";

import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { signOutAction } from "@/lib/auth-actions";
import { initials } from "@/lib/initials";

export function AdminTopbar({ userName, onMenuClick }: { userName: string; onMenuClick: () => void }) {
  return (
    <header className="flex items-center justify-between gap-2 border-b border-border bg-card px-4 py-4 sm:px-6">
      <button
        type="button"
        onClick={onMenuClick}
        className="text-foreground/70 hover:text-foreground lg:hidden"
        aria-label="Abrir menú"
      >
        <Menu className="h-6 w-6" />
      </button>
      <div className="flex flex-1 items-center justify-end gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium text-foreground">{userName}</p>
          <p className="text-xs text-muted-foreground">Administrador</p>
        </div>
        <Avatar className="shrink-0">
          <AvatarFallback className="bg-primary text-primary-foreground">
            {initials(userName)}
          </AvatarFallback>
        </Avatar>
        <form action={signOutAction}>
          <Button type="submit" variant="outline" size="sm">
            Cerrar sesión
          </Button>
        </form>
      </div>
    </header>
  );
}
