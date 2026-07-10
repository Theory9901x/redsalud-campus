import { Users2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/brand/empty-state";
import { AttendanceToggleButton } from "@/components/training-plans/attendance-toggle-button";

export type AttendanceRosterItem = {
  id: string;
  fullName: string;
  documentNumber: string;
  attended: boolean;
};

/** Sin curso vinculado (evento externo o "No aplica"): registro manual de asistencia. */
export function AttendanceRoster({
  activityId,
  roster,
  locked = false,
}: {
  activityId: string;
  roster: AttendanceRosterItem[];
  /** Etapa 6: la jornada cerró, la participación queda congelada — se oculta la acción de marcar asistencia. */
  locked?: boolean;
}) {
  if (roster.length === 0) {
    return (
      <EmptyState
        icon={Users2}
        title="Sin personal objetivo"
        description="No hay personal activo que coincida con la dependencia y la audiencia objetivo de esta actividad."
        className="py-10"
      />
    );
  }

  const attendedCount = roster.filter((u) => u.attended).length;
  const percentage = Math.round((attendedCount / roster.length) * 100);

  return (
    <div className="space-y-3">
      <div className="surface flex items-center justify-between p-4">
        <span className="font-display text-lg font-bold text-foreground">{percentage}%</span>
        <span className="text-sm text-muted-foreground">{attendedCount} de {roster.length} asistieron</span>
      </div>
      <div className="surface overflow-hidden">
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
                        ? "rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-success"
                        : "rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground"
                    }
                  >
                    {user.attended ? "Asistió" : "No asistió"}
                  </span>
                </TableCell>
                {!locked && (
                  <TableCell className="text-right">
                    <div className="flex justify-end">
                      <AttendanceToggleButton activityId={activityId} userId={user.id} attended={user.attended} />
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
