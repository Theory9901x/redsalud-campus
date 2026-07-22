import { prisma } from "@/lib/prisma";
import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "./register-form";

// Sin esto, Next.js prerenderiza esta página como estática en build (no tiene
// searchParams ni otra señal dinámica) y hornea el logoUrl de ese momento,
// quedando desactualizada si el admin cambia el logo institucional después.
export const dynamic = "force-dynamic";

export default async function RegistroPage() {
  const [settings, municipios] = await Promise.all([
    prisma.institutionSettings.findUnique({ where: { id: "singleton" } }),
    prisma.municipio.findMany({ where: { isActive: true }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
  ]);

  return (
    <AuthShell logoUrl={settings?.logoUrl ?? null}>
      <RegisterForm municipios={municipios} />
    </AuthShell>
  );
}
