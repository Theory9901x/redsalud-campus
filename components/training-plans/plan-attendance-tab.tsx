import { Check, X, UserCheck } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/brand/empty-state";
import type { getPlanAttendanceOverview } from "@/lib/training-plans";

type Datos = Awaited<ReturnType<typeof getPlanAttendanceOverview>>;

const FORMATO = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

function Chulo({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-success/15 text-success">
      <Check className="h-3.5 w-3.5" aria-label="Sí" />
    </span>
  ) : (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-muted-foreground/60">
      <X className="h-3 w-3" aria-label="No" />
    </span>
  );
}

/**
 * La lista de asistencia del plan, nominal y por capacitación: quién entró,
 * quién presentó el presaber, quién el postsaber y quién completó, con chulo
 * por cada paso. Es la evidencia que el PIC exige ("Registro de asistencia")
 * y por eso tiene pestaña propia en vez de vivir enterrada dentro de cada
 * actividad.
 */
export function PlanAttendanceTab({ datos }: { datos: Datos }) {
  const conGente = datos.filter((d) => d.personas.length > 0);

  if (datos.length === 0 || conGente.length === 0) {
    return (
      <EmptyState
        icon={UserCheck}
        title="Sin asistencias registradas todavía"
        description="En cuanto alguien entre a una evaluación de una capacitación con contenido, queda registrado aquí automáticamente, con su presaber, postsaber y completado."
        className="py-12"
      />
    );
  }

  return (
    <div className="space-y-6">
      {conGente.map((cap) => (
        <section key={cap.activityId} className="space-y-2">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="font-display text-sm font-bold text-foreground">{cap.titulo}</h2>
            <span className="text-xs text-muted-foreground">
              {cap.area} · {cap.personas.length} {cap.personas.length === 1 ? "persona" : "personas"}
            </span>
          </div>
          <div className="surface-panel overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Ingresó</TableHead>
                  <TableHead className="text-center">Presaber</TableHead>
                  <TableHead className="text-center">Postsaber</TableHead>
                  <TableHead className="text-center">Completado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cap.personas.map((p) => (
                  <TableRow key={p.documentNumber}>
                    <TableCell className="font-medium text-foreground">{p.fullName}</TableCell>
                    <TableCell className="text-muted-foreground">{p.documentNumber}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.ingreso ? FORMATO.format(p.ingreso) : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Chulo ok={p.presaber} />
                    </TableCell>
                    <TableCell className="text-center">
                      <Chulo ok={p.postsaber} />
                    </TableCell>
                    <TableCell className="text-center">
                      <Chulo ok={p.completado} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      ))}
      <p className="text-xs text-muted-foreground">
        Registro electrónico generado por autenticación institucional en la plataforma RedSalud Te Forma.
      </p>
    </div>
  );
}
