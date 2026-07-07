import { prisma } from "@/lib/prisma";
import { InstitutionSettingsForm } from "@/components/admin/institution-settings-form";
import { InstitutionAssetUploader } from "@/components/admin/institution-asset-uploader";
import { uploadInstitutionLogoAction, uploadInstitutionSignatureAction } from "@/app/admin/configuracion/actions";

export default async function ConfiguracionPage() {
  const settings = await prisma.institutionSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-foreground">Configuración institucional</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Estos datos aparecen impresos en todos los certificados emitidos.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <InstitutionAssetUploader
          action={uploadInstitutionLogoAction}
          fieldName="logo"
          label="Logo institucional"
          description="Aparece en la parte superior del certificado. PNG con fondo transparente recomendado."
          imageUrl={settings.logoUrl}
        />
        <InstitutionAssetUploader
          action={uploadInstitutionSignatureAction}
          fieldName="firma"
          label="Firma del responsable"
          description="Imagen de la firma, se imprime sobre el nombre del responsable."
          imageUrl={settings.signatureUrl}
        />
      </div>

      <InstitutionSettingsForm
        defaultValues={{
          institutionName: settings.institutionName,
          contactEmail: settings.contactEmail ?? "",
          contactPhone: settings.contactPhone ?? "",
          city: settings.city,
          certificateText: settings.certificateText ?? "",
          signerName: settings.signerName ?? "",
          signerPosition: settings.signerPosition ?? "",
        }}
      />
    </div>
  );
}
