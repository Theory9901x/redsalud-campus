import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { parseCertificateLayout } from "@/lib/certificate-template";
import { CertificateTemplateBuilder } from "@/components/certificados/certificate-template-builder";
import { AdminPageHeader } from "@/components/admin/page-header";

export default async function CertificateTemplatePage() {
  const [template, settings] = await Promise.all([
    prisma.certificateTemplate.findFirst({ where: { isDefault: true } }),
    prisma.institutionSettings.findUnique({ where: { id: "singleton" } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/certificados"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a certificados
        </Link>
        <AdminPageHeader
          title="Plantilla del certificado"
          description="Arrastra los campos del estudiante, el logo, la firma y el código QR para diseñar el certificado que se genera automáticamente. Los cambios aplican a los próximos certificados emitidos y a los que regeneres."
        />
      </div>

      <CertificateTemplateBuilder
        initialLayout={parseCertificateLayout(template?.layoutJson)}
        backgroundImageUrl={template?.backgroundImageUrl ?? null}
        logoUrl={settings?.logoUrl ?? null}
        signatureUrl={settings?.signatureUrl ?? null}
      />
    </div>
  );
}
