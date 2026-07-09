import { redirect } from "next/navigation";
import Link from "next/link";
import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import { Activity, BookOpen, CalendarRange } from "lucide-react";

export default async function TutorLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user || (session.user.role !== "TUTOR" && session.user.role !== "ADMIN")) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" strokeWidth={2.5} />
          <div>
            <p className="font-display text-base font-extrabold leading-none text-foreground">RedSalud Te Forma</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Hola, {session.user.name} (Tutor)
            </p>
          </div>
        </div>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <Button type="submit" variant="outline">
            Cerrar sesión
          </Button>
        </form>
      </header>
      <nav className="flex items-center gap-1 border-b border-border bg-card px-6 py-2">
        <Link
          href="/tutor"
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
        >
          <BookOpen className="h-4 w-4" />
          Mis cursos
        </Link>
        <Link
          href="/tutor/planes-capacitacion"
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
        >
          <CalendarRange className="h-4 w-4" />
          Planes de capacitación
        </Link>
      </nav>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
