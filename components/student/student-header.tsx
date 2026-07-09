"use client";

import Link from "next/link";
import { Menu, User, GraduationCap, LogOut, ChevronDown } from "lucide-react";
import { signOutAction } from "@/lib/auth-actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RoleBadge } from "@/components/admin/role-badge";
import { NotificationBell, type NotificationItem } from "@/components/student/notification-bell";
import { initials } from "@/lib/initials";
import { PERSONNEL_TYPE_LABELS } from "@/lib/personnel-labels";
import type { PersonnelType } from "@prisma/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function StudentHeader({
  userName,
  avatarUrl,
  notifications,
  unreadCount,
  position,
  personnelType,
  onMenuClick,
}: {
  userName: string;
  avatarUrl?: string | null;
  notifications: NotificationItem[];
  unreadCount: number;
  position?: string | null;
  personnelType: PersonnelType;
  onMenuClick?: () => void;
}) {
  const personnelTypeLabel = PERSONNEL_TYPE_LABELS[personnelType];
  const subtitle = position ? `${position} · ${personnelTypeLabel}` : personnelTypeLabel;

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
      <div className="flex w-full items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={onMenuClick}
          className="text-foreground/70 hover:text-foreground lg:hidden"
          aria-label="Abrir menú"
        >
          <Menu className="h-6 w-6" />
        </button>

        <div className="flex flex-1 items-center justify-end gap-1.5">
          <NotificationBell notifications={notifications} unreadCount={unreadCount} />

          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-2.5 outline-none transition-colors hover:bg-muted">
              <Avatar>
                {avatarUrl && <AvatarImage src={avatarUrl} alt={userName} />}
                <AvatarFallback className="bg-primary text-primary-foreground">{initials(userName)}</AvatarFallback>
              </Avatar>
              <div className="hidden text-left sm:block">
                <p className="text-sm font-medium leading-tight text-foreground">{userName}</p>
                <p className="truncate text-xs leading-tight text-muted-foreground">{subtitle}</p>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="flex items-center justify-between gap-2 py-1.5">
                  Mi cuenta
                  <RoleBadge role="STUDENT" />
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem render={<Link href="/mi-aula" />}>
                  <GraduationCap className="h-4 w-4" />
                  Mi aula completa
                </DropdownMenuItem>
                <DropdownMenuItem render={<Link href="/perfil" />}>
                  <User className="h-4 w-4" />
                  Perfil y configuración
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <form action={signOutAction}>
                  <DropdownMenuItem
                    variant="destructive"
                    nativeButton
                    render={<button type="submit" className="w-full" />}
                  >
                    <LogOut className="h-4 w-4" />
                    Cerrar sesión
                  </DropdownMenuItem>
                </form>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
