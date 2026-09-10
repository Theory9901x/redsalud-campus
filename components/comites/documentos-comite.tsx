import { ExternalLink, FileText, FileVideo, FileSpreadsheet, FileImage, File as FileIcon, Download } from "lucide-react";
import { etiquetaFecha } from "@/components/training-plans/labels";
import { cn } from "@/lib/utils";

export type DocumentoComite = {
  id: string;
  fileName: string;
  fileType: string;
  fileUrl: string;
  fileSize: number;
  createdAt: Date;
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

function extension(fileName: string) {
  return (fileName.match(/\.([a-z0-9]+)$/i)?.[1] ?? "").toUpperCase();
}

function estiloTipo(fileType: string, ext: string) {
  if (fileType === "application/pdf" || ext === "PDF") return { Icono: FileText, color: "#d64545", fondo: "rgba(214,69,69,0.12)", etiqueta: "PDF" };
  if (fileType.startsWith("video/")) return { Icono: FileVideo, color: "#2f80c2", fondo: "rgba(47,128,194,0.12)", etiqueta: "Video" };
  if (fileType.startsWith("image/")) return { Icono: FileImage, color: "#1f9d5a", fondo: "rgba(31,157,90,0.12)", etiqueta: "Imagen" };
  if (/sheet|excel|csv/.test(fileType) || ["XLSX", "XLS", "CSV"].includes(ext)) return { Icono: FileSpreadsheet, color: "#1f9d5a", fondo: "rgba(31,157,90,0.12)", etiqueta: ext || "Hoja" };
  return { Icono: FileIcon, color: "#64748b", fondo: "rgba(100,116,139,0.12)", etiqueta: ext || "Archivo" };
}

function tamano(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Lista de documentos del comité: tarjetas glass con icono por tipo y nombre completo. */
export function DocumentosComite({ documentos, vacio = "Sin documentos todavía." }: { documentos: DocumentoComite[]; vacio?: string }) {
  if (documentos.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 bg-card/40 px-4 py-6 text-center text-[13px] text-muted-foreground">
        {vacio}
      </div>
    );
  }
  return (
    <ul className="space-y-3">
      {documentos.map((d) => {
        const ext = extension(d.fileName);
        const t = estiloTipo(d.fileType, ext);
        return (
          <li key={d.id} className="comite-tarjeta flex items-center gap-4 p-4">
            <span className="relative grid h-14 w-12 shrink-0 place-items-center rounded-xl" style={{ backgroundColor: t.fondo, color: t.color }}>
              <t.Icono className="h-6 w-6" aria-hidden="true" />
              <span className="absolute -bottom-1.5 rounded-md px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-white" style={{ backgroundColor: t.color }}>
                {t.etiqueta}
              </span>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-bold leading-snug text-foreground">{nombreLegible(d.fileName)}</p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                {tamano(d.fileSize)} · {etiquetaFecha(d.createdAt)}
                {d.uploader ? ` · ${d.uploader.fullName}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <a
                href={d.fileUrl}
                target="_blank"
                rel="noreferrer"
                className={cn("inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[12.5px] font-bold text-white shadow-md transition-transform hover:-translate-y-px")}
                style={{ backgroundColor: t.color, boxShadow: `0 10px 24px -12px ${t.color}` }}
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                Ver
              </a>
              <a href={d.fileUrl} download className="grid h-9 w-9 place-items-center rounded-xl border border-border/60 bg-card/70 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary" aria-label="Descargar" title="Descargar">
                <Download className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
