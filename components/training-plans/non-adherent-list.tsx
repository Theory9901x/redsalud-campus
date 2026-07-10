import { UserX, CheckCircle2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type NonAdherentUser = { id: string; fullName: string; documentNumber: string };

/**
 * Etapa 6: al cerrar la jornada, el personal objetivo que no completó/asistió
 * se registra NOMINALMENTE (no solo como % agregado) para seguimiento de RRHH.
 */
export function NonAdherentList({ users }: { users: NonAdherentUser[] }) {
  return (
    <div className="space-y-3">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <UserX className="h-4 w-4 text-destructive" />
        Personal no adherente ({users.length}) · para seguimiento de RRHH
      </p>
      {users.length === 0 ? (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-success" />
          Todo el personal objetivo fue adherente.
        </p>
      ) : (
        <div className="surface-panel overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Documento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium text-foreground">{user.fullName}</TableCell>
                  <TableCell className="text-muted-foreground">{user.documentNumber}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
