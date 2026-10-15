import { RegistroDocumentos } from "@/components/documentos/registro-documentos";

export type DocumentoComite = {
  id: string;
  fileName: string;
  fileType: string;
  fileUrl: string;
  fileSize: number;
  createdAt: Date;
  kind?: string | null;
  description?: string | null;
  uploader?: { fullName: string } | null;
};

/**
 * El nombre en disco va "sanitizado" (sin tildes, con guiones): para
 * mostrarlo se recupera un título legible: se quita el prefijo numérico,
 * los guiones vuelven a ser espacios y se reponen las terminaciones
 * "ción" que el saneado deja como "ci n".
 */
export function nombreLegible(fileName: string) {
  const sinExt = fileName.replace(/^\d+-/, "").replace(/\.[a-z0-9]+$/i, "");
  return sinExt
    .replace(/---+/g, " · ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .replace(/ci n\b/gi, "ción")
    .replace(/si n\b/gi, "sión")
    .trim();
}




/** Documentos del comité, como registro documental compartido (ver components/documentos). */
export function DocumentosComite({ documentos, vacio = "Sin documentos todavía." }: { documentos: DocumentoComite[]; vacio?: string }) {
  return <RegistroDocumentos documentos={documentos} vacio={vacio} />;
}
