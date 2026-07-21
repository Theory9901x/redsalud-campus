"use client";

import { useEffect, useState } from "react";
import { ChevronDown, LogOut, Menu } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOutAction } from "@/lib/auth-actions";
import { initials } from "@/lib/initials";

/** Topbar de los paneles de gestión (admin y tutor: cambia solo roleLabel). */
export function AdminTopbar({
  userName,
  onMenuClick,
  roleLabel = "Administrador",
}: {
  userName: string;
  onMenuClick: () => void;
  roleLabel?: string;
}) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className="header-glass sticky top-0 z-30 flex items-center justify-between gap-2 px-4 py-3 sm:px-6"
      data-scrolled={scrolled}
    >
      <button
        type="button"
        onClick={onMenuClick}
        className="text-foreground/70 hover:text-foreground lg:hidden"
        aria-label="Abrir menú"
      >
        <Menu className="h-6 w-6" />
      </button>

      <div className="flex flex-1 items-center justify-end">
        {/* Bloque de usuario como píldora clay clickeable con menú. */}
        <DropdownMenu>
          <DropdownMenuTrigger className="surface-clay flex items-center gap-2.5 rounded-full py-1 pl-1 pr-3 outline-none transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-primary">
            <Avatar className="shrink-0">
              <AvatarFallback className="bg-primary text-primary-foreground">
                {initials(userName)}
              </AvatarFallback>
            </Avatar>
            <div className="hidden text-left sm:block">
              <p className="text-sm font-medium leading-tight text-foreground">{userName}</p>
              <p className="text-xs leading-tight text-muted-foreground">{roleLabel}</p>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <p className="text-sm font-medium">{userName}</p>
                <p className="text-xs font-normal text-muted-foreground">{roleLabel}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <form action={signOutAction}>
                <DropdownMenuItem variant="destructive" nativeButton render={<button type="submit" className="w-full" />}>
                  <LogOut className="h-4 w-4" />
                  Cerrar sesión
                </DropdownMenuItem>
              </form>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
