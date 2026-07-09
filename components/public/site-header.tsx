import Link from "next/link";
import { Activity } from "lucide-react";
import { auth } from "@/auth";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function roleHome(role: string | undefined) {
  if (role === "ADMIN") return "/admin";
  if (role === "TUTOR") return "/tutor";
  if (role === "STUDENT") return "/inicio";
  return "/login";
}

export async function SiteHeader() {
  const session = await auth();

  return (
    <div className="sticky top-4 z-40 mx-auto w-full max-w-5xl px-4">
      <header className="flex items-center justify-between rounded-full border border-border/60 bg-card/90 px-4 py-2.5 shadow-lg shadow-black/5 backdrop-blur">
        <Link href="/cursos" className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" strokeWidth={2.5} />
          <div className="leading-none">
            <p className="font-display text-sm font-extrabold text-navy">
              RedSalud <span className="text-primary">Te Forma</span>
            </p>
            <p className="text-[10px] tracking-wide text-muted-foreground">REDSALUD CASANARE E.S.E.</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground sm:flex">
          <Link href="/cursos" className="hover:text-foreground">
            Cursos
          </Link>
        </nav>

        <Link
          href={session?.user ? roleHome(session.user.role) : "/login"}
          className={cn(
            buttonVariants(),
            "gap-1.5 bg-gradient-to-r from-primary to-teal-400 text-white hover:opacity-90"
          )}
        >
          Campus Virtual →
        </Link>
      </header>
    </div>
  );
}
