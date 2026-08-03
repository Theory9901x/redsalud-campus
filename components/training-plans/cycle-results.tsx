import { Download, Users2, HelpCircle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SEMAFORO_CLASSES, nivelSemaforo } from "@/components/training-plans/labels";
import type { getCycleResults } from "@/lib/training-plans";

type Resultados = NonNullable<Awaited<ReturnType<typeof getCycleResults>>>;

function BadgeDiferencia({ valor }: { valor: number | null }) {
  if (valor === null) return <span className="text-xs text-muted-foreground">—</span>;
  const clase =
    valor > 0 ? "bg-success/10 text-success" : valor < 0 ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${clase}`}>
      {valor > 0 ? "+" : ""}
      {valor} pp
    </span>
  );
}

/**
 * Las dos lecturas de los resultados del ciclo: por persona (quién mejoró y
 * cuánto) y por pregunta (dónde está la dificultad). Solo se muestra cuando
 * hay al menos un intento presentado; una tabla vacía no le dice nada a
 * nadie.
 */
export function CycleResults({ resultados, activityId }: { resultados: Resultados; activityId: string }) {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Users2 className="h-4 w-4 text-primary" aria-hidden="true" />
            Resultados por persona
          </h3>
          <a
            href={`/api/planes-capacitacion/actividades/${activityId}/resultados`}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Exportar CSV
          </a>
        </div>
        <div className="surface-panel overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead className="text-center">Presaber</TableHead>
                <TableHead className="text-center">Postsaber</TableHead>
                <TableHead className="text-center">Diferencia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resultados.personas.map((p) => (
                <TableRow key={p.documentNumber}>
                  <TableCell className="font-medium text-foreground">{p.fullName}</TableCell>
                  <TableCell className="text-muted-foreground">{p.documentNumber}</TableCell>
                  <TableCell className="text-center">
                    {p.presaber !== null ? (
                      <Badge className={SEMAFORO_CLASSES[nivelSemaforo(p.presaber)]}>{p.presaber}%</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sin presentar</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {p.postsaber !== null ? (
                      <Badge className={SEMAFORO_CLASSES[nivelSemaforo(p.postsaber)]}>{p.postsaber}%</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sin presentar</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <BadgeDiferencia valor={p.diferencia} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {resultados.porPregunta.length > 0 && (
        <div className="space-y-3">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <HelpCircle className="h-4 w-4 text-primary" aria-hidden="true" />
            Acierto por pregunta
          </h3>
          <div className="surface-panel overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pregunta</TableHead>
                  <TableHead className="text-center">Presaber</TableHead>
                  <TableHead className="text-center">Postsaber</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resultados.porPregunta.map((q, i) => (
                  <TableRow key={i}>
                    <TableCell className="max-w-[420px] whitespace-normal text-foreground">{q.statement}</TableCell>
                    <TableCell className="text-center">
                      {q.presaber !== null ? (
                        <Badge className={SEMAFORO_CLASSES[nivelSemaforo(q.presaber)]}>{q.presaber}%</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {q.postsaber !== null ? (
                        <Badge className={SEMAFORO_CLASSES[nivelSemaforo(q.postsaber)]}>{q.postsaber}%</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground">
            Calculado sobre el mejor intento de cada persona en cada momento; las preguntas de respuesta abierta no
            suman al puntaje y no aparecen aquí.
          </p>
        </div>
      )}
    </div>
  );
}
