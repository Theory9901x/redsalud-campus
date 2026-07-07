import type { CertificateStatus } from "@prisma/client";

export const CERTIFICATE_STATUS_LABELS: Record<CertificateStatus, string> = {
  VALID: "Válido",
  REVOKED: "Anulado",
};

export const CERTIFICATE_STATUS_CLASSES: Record<CertificateStatus, string> = {
  VALID: "bg-success/10 text-success",
  REVOKED: "bg-destructive/10 text-destructive",
};
