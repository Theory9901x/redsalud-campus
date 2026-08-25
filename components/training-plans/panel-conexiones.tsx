import { Clock, PhoneCall, Timer, Users2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TablePagination } from "@/components/admin/table-pagination";
import { AutoSearchInput, AutoFilterSelect } from "@/components/admin/auto-search-input";
import type { FilaConexion, ResumenConexiones } from "@/lib/call-connections";

const FORMATO_FECHA = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

function formatearDuracion(minutos: number): string {
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto > 0 ? `${horas} h ${resto} min` : `${horas} h`;
}

/**
 * Trazabilidad de conexión a la videollamada, por plan de capacitación.
 *
 * Es un dato ENTERAMENTE de servidor: cada tramo ya quedó escrito cuando la
 * persona salió de su llamada (ver sala-virtual.tsx), así que esta pantalla
 * solo lee y pagina -nada de sondeo, nada que se actualice mientras alguien
 * está en vivo-. Misma regla del módulo que la asistencia: la tabla trae
 * solo filas con datos reales, nunca el padrón completo.
 */
export function PanelConexiones({
  resumen,
  actividades,
  filas,
  total,
  pagina,
  porPagina,
}: {
  resumen: ResumenConexiones;
  actividades: { id: string; title: string }[];
  filas: FilaConexion[];
  total: number;
  pagina: number;
  porPagina: number;
}) {
  const kpis = [
    { etiqueta: "Tramos registrados", valor: String(resumen.totalTramos), Icono: PhoneCall },
    { etiqueta: "Personas distintas", valor: String(resumen.personasDistintas), Icono: Users2 },
    { etiqueta: "Duración promedio", valor: formatearDuracion(resumen.duracionPromedioMin), Icono: Clock },
    { etiqueta: "Duración total", valor: formatearDuracion(resumen.duracionTotalMin), Icono: Timer },
  ];

  return (
    <div className="space-y-6">
      <section aria-label="Resumen de conexión" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.etiqueta} className="surface-lumen flex flex-col justify-between gap-3 p-5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
              <k.Icono className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="font-display text-[1.75rem] font-extrabold leading-none tracking-tight text-foreground">
                {k.valor}
              </p>
              <p className="mt-1.5 text-[12px] leading-tight text-muted-foreground">{k.etiqueta}</p>
            </div>
          </div>
        ))}
      </section>

      <div className="surface-panel flex flex-wrap items-end gap-3 p-4">
        <AutoSearchInput label="Buscar persona" placeholder="Nombre..." />
        <AutoFilterSelect
          paramName="actividad"
          label="Jornada"
          options={actividades.map((a) => ({ value: a.id, label: a.title }))}
        />
      </div>

      <div className="surface-glass overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Persona</TableHead>
              <TableHead>Jornada</TableHead>
              <TableHead className="text-right">Conexiones</TableHead>
              <TableHead className="text-right">Tiempo conectado</TableHead>
              <TableHead className="text-right">Última conexión</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  Todavía no hay tramos de conexión registrados. Se escriben solos, en cuanto alguien salga de una
                  videollamada de este plan.
                </TableCell>
              </TableRow>
            )}
            {filas.map((f) => (
              <TableRow key={f.clave}>
                <TableCell className="font-medium text-foreground">{f.displayName}</TableCell>
                <TableCell className="text-muted-foreground">{f.activityTitle}</TableCell>
                <TableCell className="text-right text-muted-foreground">{f.tramos}</TableCell>
                <TableCell className="text-right font-semibold text-foreground">
                  {formatearDuracion(f.duracionTotalMin)}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {FORMATO_FECHA.format(f.ultimaConexion)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination total={total} page={pagina} pageSize={porPagina} />
      </div>
    </div>
  );
}
