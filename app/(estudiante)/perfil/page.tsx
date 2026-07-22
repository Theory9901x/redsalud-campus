import { User, Mail, IdCard, Briefcase, Phone, GraduationCap, Building2, MapPin, BadgeCheck } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getUserAvatarUrl } from "@/lib/avatar";
import { AvatarUploader } from "@/components/student/avatar-uploader";
import { ChangePasswordForm } from "@/components/student/change-password-form";
import { PERSONNEL_TYPE_LABELS } from "@/lib/personnel-labels";
import { MarcaPlanta, VINCULACION_LABELS, esPlanta } from "@/components/admin/marca-planta";

export default async function PerfilPage() {
  const session = await auth();
  const [user, avatarUrl] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: session!.user.id }, include: { municipio: true } }),
    getUserAvatarUrl(session!.user.id),
  ]);

  const infoRows = [
    { icon: IdCard, label: "Documento", value: `${user.documentType} ${user.documentNumber}` },
    { icon: Mail, label: "Correo", value: user.email },
    { icon: Phone, label: "Teléfono", value: user.phone || "—" },
    { icon: GraduationCap, label: "Profesión", value: user.profession || "—" },
    { icon: Briefcase, label: "Cargo", value: user.position || "—" },
    { icon: Building2, label: "Tipo de personal", value: PERSONNEL_TYPE_LABELS[user.personnelType] },
    { icon: MapPin, label: "Municipio", value: user.municipio?.nombre ?? "—" },
    { icon: BadgeCheck, label: "Vinculación", value: VINCULACION_LABELS[user.tipoVinculacion] },
  ];

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 py-8 sm:px-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-foreground">Perfil y configuración</h1>
        <p className="mt-1 text-sm text-muted-foreground">Gestiona tu cuenta y tu foto de perfil.</p>
      </div>

      <section className="surface-glass space-y-4 p-6">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-primary" />
          <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">Foto de perfil</h2>
        </div>
        <AvatarUploader avatarUrl={avatarUrl} />
      </section>

      <section className="surface-glass space-y-4 p-6">
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">Mis datos</h2>
        <div>
          <p className="flex items-center gap-2 font-display text-lg font-extrabold text-foreground">
            <MarcaPlanta tipo={user.tipoVinculacion} />
            {user.fullName}
            {esPlanta(user.tipoVinculacion) && (
              <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning-foreground">
                Planta
              </span>
            )}
          </p>
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

      <section className="surface-glass space-y-4 p-6">
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
          Cambiar contraseña
        </h2>
        <ChangePasswordForm />
      </section>
    </main>
  );
}
