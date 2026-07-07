import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin caracteres ambiguos (0/O, 1/I)

function randomSegment(length: number): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CODE_CHARS[bytes[i] % CODE_CHARS.length];
  }
  return out;
}

/** Genera un código único con formato RSC-AAAA-XXXXXX, reintentando ante colisión. */
export async function generateCertificateCode(): Promise<string> {
  const year = new Date().getFullYear();
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = `RSC-${year}-${randomSegment(6)}`;
    const existing = await prisma.certificate.findUnique({ where: { certificateCode: code }, select: { id: true } });
    if (!existing) return code;
  }
  throw new Error("No se pudo generar un código de certificado único.");
}

/** Token secundario único almacenado junto al certificado, reservado para validación reforzada futura. */
export function generateValidationHash(): string {
  return randomBytes(24).toString("hex");
}
