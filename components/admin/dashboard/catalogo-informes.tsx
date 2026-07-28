import { FileText } from "lucide-react";
import { ExportarReporte } from "@/components/admin/dashboard/exportar-reporte";
import { TIPOS_REPORTE, REPORTE_META } from "@/lib/reportes-meta";

/**
 * Catálogo de informes en PDF.
 *
 * Vive aquí y en el panel de control porque son los dos sitios desde los que
 * alguien va a querer un informe: mientras mira los datos, o cuando entra
 * expresamente a "Reportes". Es el MISMO componente de exportación en ambos,
 * no dos caminos que puedan divergir.
 *
 * Los filtros se leen de la URL, y como esta página usa `curso` con el mismo
 * nombre que el panel, filtrar por curso aquí también filtra el PDF sin tener
 * que hacer nada extra.
 */
export function CatalogoInformes() {
  return (
    <section className="surface-panel space-y-4 p-5">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-[var(--accent)]" />
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
          Informes en PDF
        </h2>
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">
        Documentos con membrete institucional, listos para firmar y archivar. «Ver hoja» abre el informe en el
        navegador por si prefieres imprimirlo tú; cada descarga queda registrada en la bitácora.
      </p>

      <ul className="grid gap-3 md:grid-cols-3">
        {TIPOS_REPORTE.map((tipo) => (
          <li key={tipo} className="surface flex flex-col gap-3 p-4">
            <div className="min-w-0">
              <p className="font-semibold text-foreground">{REPORTE_META[tipo].titulo}</p>
              <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                {REPORTE_META[tipo].descripcion}
              </p>
            </div>
            <div className="mt-auto">
              <ExportarReporte tipo={tipo} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
