import Link from "next/link";
import { Users2, Search } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/brand/empty-state";
import { AttendanceToggleButton } from "@/components/training-plans/attendance-toggle-button";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type AttendanceRosterItem = {
  id: string;
  fullName: string;
  documentNumber: string;
  attended: boolean;
};

/**
 * Registro nominal de asistencia, por página.
 *
 * El porcentaje de arriba llega ya CONTADO desde el servidor: antes salía de
 * medir el largo de la lista, lo que obligaba a traer la audiencia entera
 * -doscientas y pico filas, casi todas diciendo "No asistió"- solo para poder
 * escribir un número. Ahora la tabla muestra a quien tiene registro en la
 * jornada, y quien busca a alguien puntual lo encuentra por nombre o
 * documento sin que nadie cargue el resto.
 */
export function AttendanceRoster({
  activityId,
  roster,
  conteos,
  paginacion,
  buscar,
  locked = false,
}: {
  activityId: string;
  roster: AttendanceRosterItem[];
  conteos: { asistieron: number; totalAudiencia: number; porcentaje: number };
  paginacion: { pagina: number; porPagina: number; total: number };
  buscar: string;
  /** La jornada cerró, la participación queda congelada — se oculta la acción de marcar asistencia. */
  locked?: boolean;
}) {
  const paginas = Math.max(1, Math.ceil(paginacion.total / paginacion.porPagina));
  const enBusqueda = buscar.trim() !== "";
  const qs = (pagina: number) => {
    const p = new URLSearchParams();
    if (enBusqueda) p.set("asistencia", buscar);
    if (pagina > 1) p.set("pagina", String(pagina));
    const s = p.toString();
    return s ? `?${s}` : "?";
  };

  return (
    <div className="space-y-3">
      <div className="surface flex flex-wrap items-center justify-between gap-3 p-4">
        <span className="font-display text-lg font-bold text-foreground">{conteos.porcentaje}%</span>
        <span className="text-sm text-muted-foreground">
          {conteos.asistieron} de {conteos.totalAudiencia} asistieron
        </span>
      </div>

      {/* Formulario GET: la búsqueda vive en la URL, así el servidor pagina y
          la página se puede compartir o recargar sin perder el filtro. */}
      <form method="get" className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="asistencia"
            defaultValue={buscar}
            placeholder="Buscar por nombre o documento para marcar asistencia…"
            className="pl-9"
            aria-label="Buscar persona en la audiencia"
          />
        </div>
        <Button type="submit" size="sm" variant="outline">Buscar</Button>
        {enBusqueda && (
          <Link href="?" className="text-xs font-semibold text-muted-foreground hover:text-foreground">
            Quitar búsqueda
          </Link>
        )}
      </form>

      {roster.length === 0 ? (
        <EmptyState
          icon={Users2}
          title={enBusqueda ? "Nadie coincide con esa búsqueda" : "Todavía nadie registra asistencia"}
          description={
            enBusqueda
              ? "Revisa el nombre o el documento. La búsqueda cubre todo el personal al que va dirigida esta capacitación."
              : "Aquí aparece quien va asistiendo. Para marcar a alguien manualmente, búscalo por nombre o documento."
          }
          className="py-10"
        />
      ) : (
        <>
          <div className="surface-panel overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Estado</TableHead>
                  {!locked && <TableHead className="text-right">Acciones</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {roster.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium text-foreground">{user.fullName}</TableCell>
                    <TableCell className="text-muted-foreground">{user.documentNumber}</TableCell>
                    <TableCell>
                      <span
                        className={
                          user.attended
                            ? "inline-flex rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-success"
                            : "inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground"
                        }
                      >
                        {user.attended ? "Asistió" : "No asistió"}
                      </span>
                    </TableCell>
                    {!locked && (
                      <TableCell className="text-right">
                        <AttendanceToggleButton activityId={activityId} userId={user.id} attended={user.attended} />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {paginas > 1 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Página {paginacion.pagina} de {paginas} · {paginacion.total} personas
              </span>
              <div className="flex gap-2">
                {paginacion.pagina > 1 && (
                  <Link href={qs(paginacion.pagina - 1)} className="font-semibold text-primary hover:underline">
                    Anterior
                  </Link>
                )}
                {paginacion.pagina < paginas && (
                  <Link href={qs(paginacion.pagina + 1)} className="font-semibold text-primary hover:underline">
                    Siguiente
                  </Link>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
