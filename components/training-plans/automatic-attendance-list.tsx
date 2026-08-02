import { UserCheck } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/brand/empty-state";

const FORMATO_FECHA_HORA = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

export type AsistenciaAutomatica = {
  registeredAt: Date;
  source: "MANUAL" | "AUTOMATIC";
  user: { id: string; fullName: string; documentNumber: string };
};

/**
 * Con curso vinculado: quién ya se presentó a SU evaluación, sin esperar a
 * que termine el curso completo. No tiene acciones de marcar/desmarcar
 * -no es un registro manual, es la huella de haber entrado a la evaluación-,
 * solo el momento en que ocurrió.
 */
export function AutomaticAttendanceList({ asistencias }: { asistencias: AsistenciaAutomatica[] }) {
  if (asistencias.length === 0) {
    return (
      <EmptyState
        icon={UserCheck}
        title="Nadie ha entrado a la evaluación todavía"
        description="En cuanto alguien abra su presaber o postsaber, queda registrado aquí automáticamente."
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
            <TableHead>Documento</TableHead>
            <TableHead>Ingresó</TableHead>
            <TableHead>Origen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {asistencias.map((a) => (
            <TableRow key={a.user.id}>
              <TableCell className="font-medium text-foreground">{a.user.fullName}</TableCell>
              <TableCell className="text-muted-foreground">{a.user.documentNumber}</TableCell>
              <TableCell className="text-muted-foreground">{FORMATO_FECHA_HORA.format(a.registeredAt)}</TableCell>
              <TableCell>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                  {a.source === "AUTOMATIC" ? "Automático" : "Manual"}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
