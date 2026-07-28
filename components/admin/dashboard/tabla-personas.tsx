import Link from "next/link";
import { Users } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/brand/empty-state";
import { ESTADO_FORMACION_LABEL, getPersonas } from "@/lib/admin-dashboard";
import type { EstadoFormacion, FiltrosPanel } from "@/lib/admin-dashboard";

/** Color e ícono textual por estado; el texto va siempre, el color acompaña. */
const TONO: Record<EstadoFormacion, string> = {
  SIN_ASIGNAR: "var(--data-2)",
  SIN_INGRESAR: "var(--data-4)",
  SIN_AVANCE: "var(--data-5)",
  EN_CURSO: "var(--data-3)",
  COMPLETADO: "var(--data-1)",
};

/**
 * Tabla de detalle: quién es quién y en qué punto está. Ordenada por estado
 * ascendente, de forma que la primera pantalla es la lista de gente a la que
 * hay que llamar, no un listado alfabético.
 *
 * Cada fila enlaza a `?persona=<id>`, que abre el panel lateral sin recargar
 * la página ni perder los filtros.
 */
export async function TablaPersonas({
  filtros,
  pagina,
  queryBase,
}: {
  filtros: FiltrosPanel;
  pagina: number;
  /** searchParams actuales, para conservar los filtros al paginar. */
  queryBase: URLSearchParams;
}) {
  const { filas, total, porPagina } = await getPersonas(filtros, pagina);

  if (filas.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Ninguna persona coincide"
        description="Prueba a quitar algún filtro para ampliar la búsqueda."
      />
    );
  }

  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));

  function enlace(destino: Record<string, string>) {
    const p = new URLSearchParams(queryBase.toString());
    for (const [k, v] of Object.entries(destino)) p.set(k, v);
    return `/admin?${p.toString()}`;
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Persona</TableHead>
              <TableHead className="hidden sm:table-cell">Municipio</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-28 text-right">Avance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.map((fila) => (
              <TableRow key={fila.id} className="cursor-pointer">
                <TableCell className="max-w-0">
                  <Link href={enlace({ persona: fila.id })} className="block">
                    <span className="block truncate font-medium text-foreground">{fila.fullName}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {fila.documentNumber}
                      {" · "}
                      {fila.personnelType === "ASISTENCIAL" ? "Asistencial" : "Administrativo"}
                    </span>
                  </Link>
                </TableCell>
                <TableCell className="hidden text-muted-foreground sm:table-cell">
                  <Link href={enlace({ persona: fila.id })} className="block truncate">
                    {fila.municipio ?? "—"}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={enlace({ persona: fila.id })} className="flex items-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: TONO[fila.estado] }}
                    />
                    <span className="truncate text-xs text-foreground">{ESTADO_FORMACION_LABEL[fila.estado]}</span>
                  </Link>
                </TableCell>
                <TableCell className="text-right">
                  <Link href={enlace({ persona: fila.id })} className="block">
                    <span className="text-sm font-semibold tabular-nums text-foreground">{fila.avance}%</span>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPaginas > 1 && (
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>
            {total} {total === 1 ? "persona" : "personas"} · página {pagina} de {totalPaginas}
          </span>
          <div className="flex gap-2">
            {pagina > 1 && (
              <Link
                href={enlace({ pagina: String(pagina - 1) })}
                className="rounded-lg border border-border px-2.5 py-1 transition-colors hover:bg-muted"
              >
                Anterior
              </Link>
            )}
            {pagina < totalPaginas && (
              <Link
                href={enlace({ pagina: String(pagina + 1) })}
                className="rounded-lg border border-border px-2.5 py-1 transition-colors hover:bg-muted"
              >
                Siguiente
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
