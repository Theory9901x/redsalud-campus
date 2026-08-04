import { Globe } from "lucide-react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

export type ExternoFila = {
  fullName: string;
  company: string;
  registradoEtiqueta: string;
  presaber: number | null;
  postsaber: number | null;
};

/**
 * Los INVITADOS externos de la jornada: gente de otras entidades que entró
 * por el enlace público (sin cuenta) y presentó su ciclo. Lista aparte de la
 * asistencia interna a propósito: son poblaciones distintas y el informe las
 * reporta por separado.
 */
export function ExternalParticipantsPanel({ externos }: { externos: ExternoFila[] }) {
  return (
    <div className="surface-panel space-y-3 p-6">
      <div>
        <h2 className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-foreground">
          <Globe className="h-4 w-4 text-primary" aria-hidden="true" />
          Participantes externos ({externos.length})
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Registrados por el enlace público de invitados: nombre y empresa, con su resultado del ciclo. No tienen
          cuenta en la plataforma.
        </p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Empresa / entidad</TableHead>
            <TableHead>Registro</TableHead>
            <TableHead className="text-center">Presaber</TableHead>
            <TableHead className="text-center">Postsaber</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {externos.map((e, i) => (
            <TableRow key={i}>
              <TableCell className="font-medium text-foreground">{e.fullName}</TableCell>
              <TableCell className="text-muted-foreground">{e.company}</TableCell>
              <TableCell className="text-muted-foreground">{e.registradoEtiqueta}</TableCell>
              <TableCell className="text-center font-semibold">
                {e.presaber !== null ? `${e.presaber}%` : "—"}
              </TableCell>
              <TableCell className="text-center font-semibold">
                {e.postsaber !== null ? `${e.postsaber}%` : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
