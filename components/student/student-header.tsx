import Link from "next/link";
import { Activity, User, GraduationCap, LogOut, ChevronDown } from "lucide-react";
import { signOut } from "@/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function StudentHeader({ userName, avatarUrl }: { userName: string; avatarUrl?: string | null }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
        <Link href="/inicio" className="flex items-center gap-2.5">
          <Activity className="h-6 w-6 shrink-0 text-primary" strokeWidth={2.5} />
          <span className="font-display text-base font-extrabold leading-none text-foreground">
            RedSalud <span className="text-primary">Forma</span>
          </span>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-2.5 outline-none transition-colors hover:bg-muted">
            <Avatar>
              {avatarUrl && <AvatarImage src={avatarUrl} alt={userName} />}
              <AvatarFallback className="bg-primary text-primary-foreground">{initials(userName)}</AvatarFallback>
            </Avatar>
            <div className="hidden text-left sm:block">
              <p className="text-sm font-medium leading-tight text-foreground">{userName}</p>
              <p className="text-xs leading-tight text-muted-foreground">Estudiante</p>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Mi cuenta</DropdownMenuLabel>
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
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/login" });
                }}
              >
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
    </header>
  );
}
