import { FileText, Download } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/brand/empty-state";

export type TrainingDocumentItem = {
  id: string;
  fileName: string;
  fileType: string;
  fileUrl: string;
  createdAt: Date;
  uploader: { fullName: string };
};

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Repositorio ordenado (Etapa 2): nombre, tipo, fecha, quién subió. */
export function TrainingDocumentList({
  documents,
}: {
  documents: (TrainingDocumentItem & { fileSize: number })[];
}) {
  if (documents.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="Sin documentos todavía"
        description="Sube el primero con el formulario de abajo."
        className="py-10"
      />
    );
  }

  return (
    <div className="surface-panel overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Subido por</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((doc) => (
            <TableRow key={doc.id}>
              <TableCell className="font-medium text-foreground">{doc.fileName}</TableCell>
              <TableCell className="text-muted-foreground">
                {doc.fileType} · {formatFileSize(doc.fileSize)}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {doc.createdAt.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })}
              </TableCell>
              <TableCell className="text-muted-foreground">{doc.uploader.fullName}</TableCell>
              <TableCell>
                <div className="flex items-center justify-end">
                  <a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-primary hover:bg-primary/10"
                    title="Descargar"
                  >
                    <Download className="h-4 w-4" />
                  </a>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
