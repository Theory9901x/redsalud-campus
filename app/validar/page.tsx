import { redirect } from "next/navigation";
import Link from "next/link";
import { Activity, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default async function ValidarPage({
  searchParams,
}: {
  searchParams: Promise<{ codigo?: string }>;
}) {
  const { codigo } = await searchParams;
  if (codigo && codigo.trim()) {
    redirect(`/validar/${encodeURIComponent(codigo.trim())}`);
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center gap-2 border-b border-border bg-card px-4 py-3.5 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" strokeWidth={2.5} />
          <span className="font-display text-sm font-extrabold text-foreground">RedSalud Forma</span>
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="surface w-full max-w-md space-y-5 p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <div>
            <h1 className="font-display text-xl font-extrabold text-foreground">Validar un certificado</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Escribe el código impreso en el certificado (formato RSC-AAAA-XXXXXX) para verificar su autenticidad.
            </p>
          </div>
          <form method="get" className="flex flex-col gap-3 sm:flex-row">
            <Input name="codigo" placeholder="RSC-2026-ABC123" required className="flex-1 text-center sm:text-left" />
            <Button type="submit">Validar</Button>
          </form>
        </div>
      </main>
    </div>
  );
}
