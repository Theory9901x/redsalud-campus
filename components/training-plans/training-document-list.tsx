import { FileText, Download, Video } from "lucide-react";
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

  // Las grabaciones de la jornada se ven aquí mismo: una evidencia de video
  // que solo se puede descargar obliga a salir de la plataforma para saber
  // qué quedó grabado. El archivo se sirve por la misma ruta privada, así
  // que sigue restringido a quien puede gestionar la capacitación.
  const grabaciones = documents.filter((d) => d.fileType.startsWith("video/"));

  return (
    <div className="space-y-3">
      {grabaciones.length > 0 && (
        <div className="surface-lumen space-y-4 p-5">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            <Video className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            {grabaciones.length === 1 ? "Grabación de la jornada" : "Grabaciones de la jornada"}
          </p>
          {grabaciones.map((g) => (
            <div key={g.id} className="space-y-1.5">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video
                src={g.fileUrl}
                controls
                preload="metadata"
                className="max-h-[420px] w-full rounded-xl border border-border/60 bg-navy"
              />
              <p className="text-[11px] text-muted-foreground">
                {g.fileName} · {formatFileSize(g.fileSize)} ·{" "}
                {g.createdAt.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            </div>
          ))}
        </div>
      )}

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
    </div>
  );
}
