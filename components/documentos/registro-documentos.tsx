import { Download, ExternalLink, Video } from "lucide-react";
import { IconoArchivo } from "@/components/documentos/icono-archivo";
import { FORMATOS, TIPOS_DOCUMENTO, formatoDe, nombreLegibleDocumento, tamanoLegible, tipoDocumentoDe, type ContextoDocumento } from "@/lib/documentos";
import { cn } from "@/lib/utils";

export type DocumentoRegistro = {
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

const FECHA = new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Bogota" });
const HORA = new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" });
const f = (d: Date) => FECHA.format(d).replace(/\s/g, " ");
const h = (d: Date) => HORA.format(d).replace(/\s/g, " ");

/**
 * REGISTRO DOCUMENTAL: los archivos de una capacitación, un plan, un comité o
 * una sesión como una tabla de base de datos, no como enlaces sueltos: logo
 * del formato, tipo documental (qué es), descripción, formato y tamaño,
 * fecha y quién lo cargó, con ver y descargar. Las grabaciones se
 * reproducen arriba, dentro de la plataforma.
 *
 * `contexto` (por defecto "capacitacion", el de planes y capacitaciones):
 * un tipo que no aplica ahí -un "ACTA" viejo en una capacitación- se lee
 * como «Otro documento». Comités y reuniones pasan el suyo.
 */
export function RegistroDocumentos({
  documentos,
  vacio = "Sin documentos todavía.",
  reproducirGrabaciones = true,
  compacto = false,
  contexto = "capacitacion",
}: {
  documentos: DocumentoRegistro[];
  vacio?: string;
  reproducirGrabaciones?: boolean;
  compacto?: boolean;
  contexto?: ContextoDocumento;
}) {
  if (documentos.length === 0) {
    return <div className="doc-vacio">{vacio}</div>;
  }
  const grabaciones = reproducirGrabaciones ? documentos.filter((d) => formatoDe(d.fileType, d.fileName) === "video") : [];
  const porTipo = documentos.reduce<Record<string, number>>((m, d) => {
    const t = tipoDocumentoDe(d, contexto);
    m[t] = (m[t] ?? 0) + 1;
    return m;
  }, {});

  return (
    <div className="space-y-4">
      {grabaciones.length > 0 && (
        <div className="doc-grabaciones">
          <p className="mono-label flex items-center gap-1.5">
            <Video className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            {grabaciones.length === 1 ? "Grabación de la jornada" : `Grabaciones de la jornada · ${grabaciones.length}`}
          </p>
          <div className={cn("grid gap-3", grabaciones.length > 1 && "md:grid-cols-2")}>
            {grabaciones.map((g) => (
              <figure key={g.id}>
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video src={g.fileUrl} controls preload="metadata" className="w-full rounded-xl border border-border/60 bg-navy" />
                <figcaption className="mt-1.5 text-[11.5px] text-muted-foreground">
                  {nombreLegibleDocumento(g.fileName)} · {tamanoLegible(g.fileSize)} · {f(g.createdAt)}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      )}

      <div className="doc-registro" data-compacto={compacto || undefined}>
        <div className="doc-registro-cabecera">
          <span className="mono-label">Registro documental · {documentos.length} {documentos.length === 1 ? "archivo" : "archivos"}</span>
          <span className="flex flex-wrap gap-1.5">
            {Object.entries(porTipo).map(([t, n]) => (
              <span key={t} className="doc-chip">
                {TIPOS_DOCUMENTO[t as keyof typeof TIPOS_DOCUMENTO]} <b>{n}</b>
              </span>
            ))}
          </span>
        </div>
        <table className="doc-tabla">
          <thead>
            <tr>
              <th>Documento</th>
              <th>Tipo documental</th>
              <th>Formato</th>
              <th>Fecha de carga</th>
              <th>Cargado por</th>
              <th className="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {documentos.map((d) => {
              const formato = formatoDe(d.fileType, d.fileName);
              const tipo = tipoDocumentoDe(d, contexto);
              return (
                <tr key={d.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <IconoArchivo fileType={d.fileType} fileName={d.fileName} />
                      <div className="min-w-0">
                        <p className="doc-nombre">{nombreLegibleDocumento(d.fileName)}</p>
                        <p className="doc-desc">{d.description?.trim() || <span className="opacity-60">Sin descripción</span>}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="doc-tipo" data-tipo={tipo}>
                      {TIPOS_DOCUMENTO[tipo]}
                    </span>
                    {!d.kind && <span className="doc-inferido">deducido</span>}
                  </td>
                  <td className="font-mono text-[12px]">
                    {FORMATOS[formato].etiqueta}
                    <span className="block text-[11px] text-muted-foreground">{tamanoLegible(d.fileSize)}</span>
                  </td>
                  <td className="font-mono text-[12px]">
                    {f(d.createdAt)}
                    <span className="block text-[11px] text-muted-foreground">{h(d.createdAt)}</span>
                  </td>
                  <td className="text-[12.5px]">{d.uploader?.fullName ?? "Plataforma"}</td>
                  <td>
                    <div className="flex items-center justify-end gap-1">
                      <a href={d.fileUrl} target="_blank" rel="noreferrer" className="doc-accion" title="Ver">
                        <ExternalLink className="h-4 w-4" aria-hidden="true" />
                        <span>Ver</span>
                      </a>
                      <a href={d.fileUrl} download className="doc-accion doc-accion-primaria" title="Descargar">
                        <Download className="h-4 w-4" aria-hidden="true" />
                        <span>Descargar</span>
                      </a>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
