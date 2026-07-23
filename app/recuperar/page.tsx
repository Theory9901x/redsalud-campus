import { prisma } from "@/lib/prisma";
import { AuthShell } from "@/components/auth/auth-shell";
import { RecuperarForm } from "./recuperar-form";

// Igual que /login y /registro: el logo institucional se lee en cada petición
// para que un cambio de logo no quede horneado en un prerender.
export const dynamic = "force-dynamic";

export default async function RecuperarPage() {
  const settings = await prisma.institutionSettings.findUnique({ where: { id: "singleton" } });

  return (
    <AuthShell logoUrl={settings?.logoUrl ?? null}>
      <RecuperarForm />
    </AuthShell>
  );
}
