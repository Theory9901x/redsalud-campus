import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AuthShell } from "@/components/auth/auth-shell";
import { FormularioCambioObligatorio } from "./formulario";

/** A dónde va cada quien cuando ya tiene su propia contraseña. */
function inicioSegunRol(role: string) {
  if (role === "ADMIN") return "/admin";
  if (role === "TUTOR") return "/tutor";
  return "/inicio";
}

export default async function CambiarContrasenaPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Quien ya la cambió no tiene nada que hacer aquí: la página no es un lugar
  // al que se entre a voluntad, es el paso obligado del primer ingreso.
  if (!session.user.mustChangePassword) redirect(inicioSegunRol(session.user.role));

  const settings = await prisma.institutionSettings.findUnique({ where: { id: "singleton" } });

  return (
    <AuthShell logoUrl={settings?.logoUrl ?? null}>
      <FormularioCambioObligatorio destino={inicioSegunRol(session.user.role)} />
    </AuthShell>
  );
}
