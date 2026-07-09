import { prisma } from "@/lib/prisma";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  const settings = await prisma.institutionSettings.findUnique({ where: { id: "singleton" } });

  return (
    <AuthShell logoUrl={settings?.logoUrl ?? null}>
      <LoginForm callbackUrl={callbackUrl} />
    </AuthShell>
  );
}
