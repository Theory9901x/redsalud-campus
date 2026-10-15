import { FileText, FileSpreadsheet, FileVideo, FileImage, FileAudio, FileArchive, File as FileIcon, Presentation, FileType2 } from "lucide-react";
import { FORMATOS, formatoDe, type Formato } from "@/lib/documentos";
import { cn } from "@/lib/utils";

const ICONO: Record<Formato, typeof FileText> = {
  pdf: FileText,
  word: FileType2,
  excel: FileSpreadsheet,
  powerpoint: Presentation,
  video: FileVideo,
  imagen: FileImage,
  audio: FileAudio,
  zip: FileArchive,
  texto: FileText,
  otro: FileIcon,
};

/** Logo de formato (PDF rojo, Word azul, Excel verde, PowerPoint naranja…) con su sigla, como en un gestor documental. */
export function IconoArchivo({ fileType, fileName, tamano = "md", className }: { fileType: string; fileName: string; tamano?: "sm" | "md" | "lg"; className?: string }) {
  const formato = formatoDe(fileType, fileName);
  const Icono = ICONO[formato];
  return (
    <span className={cn("doc-icono", `doc-icono-${tamano}`, className)} data-formato={formato} title={FORMATOS[formato].etiqueta} aria-label={FORMATOS[formato].etiqueta}>
      <Icono aria-hidden="true" />
      <b>{FORMATOS[formato].sigla}</b>
    </span>
  );
}
