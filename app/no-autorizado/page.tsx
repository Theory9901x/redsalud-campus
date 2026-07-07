import Link from "next/link";
import { auth, signOut } from "@/auth";
import { Button, buttonVariants } from "@/components/ui/button";

function roleHome(role: string | undefined) {
  if (role === "ADMIN") return "/admin";
  if (role === "TUTOR") return "/tutor";
  return "/inicio";
}

export default async function NoAutorizadoPage() {
  const session = await auth();

  return (
    <div className="flex min-h-screen flex-1 flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <h1 className="font-display text-3xl font-extrabold text-foreground">Acceso no autorizado</h1>
      <p className="max-w-md text-muted-foreground">
        Tu cuenta no tiene permisos para ver esta sección del campus virtual.
      </p>
      <div className="flex gap-3">
        <Link href={roleHome(session?.user?.role)} className={buttonVariants()}>
          Volver a mi panel
        </Link>
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
      </div>
    </div>
  );
}
