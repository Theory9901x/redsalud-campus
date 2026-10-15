import { RegistroDocumentos, type DocumentoRegistro } from "@/components/documentos/registro-documentos";

export type TrainingDocumentItem = {
  id: string;
  fileName: string;
  fileType: string;
  fileUrl: string;
  createdAt: Date;
  kind?: string | null;
  description?: string | null;
  uploader: { fullName: string };
};

/** Documentos de un plan, una capacitación o una sesión, como registro documental (ver components/documentos). */
export function TrainingDocumentList({ documents }: { documents: (TrainingDocumentItem & { fileSize: number })[] }) {
  return <RegistroDocumentos documentos={documents as DocumentoRegistro[]} vacio="Sin documentos todavía. Sube el primero con el formulario de abajo: indica qué documento es y una descripción corta." />;
}
