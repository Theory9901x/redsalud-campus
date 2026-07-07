import { User, Mail, IdCard, Briefcase, Phone } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getUserAvatarUrl } from "@/lib/avatar";
import { AvatarUploader } from "@/components/student/avatar-uploader";
import { ChangePasswordForm } from "@/components/student/change-password-form";

export default async function PerfilPage() {
  const session = await auth();
  const [user, avatarUrl] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: session!.user.id } }),
    getUserAvatarUrl(session!.user.id),
  ]);

  const infoRows = [
    { icon: IdCard, label: "Documento", value: `${user.documentType} ${user.documentNumber}` },
    { icon: Mail, label: "Correo", value: user.email },
    { icon: Phone, label: "Teléfono", value: user.phone || "—" },
    { icon: Briefcase, label: "Profesión", value: user.profession || "—" },
  ];

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 py-8 sm:px-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-foreground">Perfil y configuración</h1>
        <p className="mt-1 text-sm text-muted-foreground">Gestiona tu cuenta y tu foto de perfil.</p>
      </div>

      <section className="surface space-y-4 p-6">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-primary" />
          <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">Foto de perfil</h2>
        </div>
        <AvatarUploader avatarUrl={avatarUrl} />
      </section>

      <section className="surface space-y-4 p-6">
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">Mis datos</h2>
        <div>
          <p className="font-display text-lg font-extrabold text-foreground">{user.fullName}</p>
          <div className="mt-3 space-y-2.5">
            {infoRows.map((row) => (
              <div key={row.label} className="flex items-center gap-3 text-sm">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <row.icon className="h-4 w-4" />
                </span>
                <span className="text-muted-foreground">
                  {row.label}: <span className="text-foreground">{row.value}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="surface space-y-4 p-6">
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
          Cambiar contraseña
        </h2>
        <ChangePasswordForm />
      </section>
    </main>
  );
}
