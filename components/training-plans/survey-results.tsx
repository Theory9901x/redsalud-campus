import { Users2, UserX } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/brand/empty-state";
import type { SurveyQuestionResult } from "@/lib/surveys";

function QuestionResultCard({ result }: { result: SurveyQuestionResult }) {
  return (
    <div className="surface space-y-3 p-4">
      <p className="font-medium text-foreground">{result.statement}</p>

      {(result.type === "SINGLE_CHOICE" || result.type === "MULTIPLE_CHOICE") && (
        <div className="space-y-2">
          {result.options.map((option) => {
            const pct = result.totalAnswers > 0 ? Math.round((option.count / result.totalAnswers) * 100) : 0;
            return (
              <div key={option.text} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-foreground">{option.text}</span>
                  <span className="text-muted-foreground">{option.count} ({pct}%)</span>
                </div>
                <Progress value={pct} />
              </div>
            );
          })}
        </div>
      )}

      {result.type === "SCALE" && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Promedio: <span className="font-bold text-foreground">{result.average ?? "—"}</span>
          </p>
          <div className="flex flex-wrap gap-3">
            {result.distribution.map((d) => (
              <div key={d.value} className="rounded-lg bg-muted px-3 py-1.5 text-center text-xs">
                <p className="font-bold text-foreground">{d.value}</p>
                <p className="text-muted-foreground">{d.count}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.type === "TEXT" &&
        (result.texts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin respuestas de texto todavía.</p>
        ) : (
          <ul className="space-y-1.5">
            {result.texts.map((text, i) => (
              <li key={i} className="rounded-lg bg-muted px-3 py-2 text-sm text-foreground">
                “{text}”
              </li>
            ))}
          </ul>
        ))}

      <p className="text-xs text-muted-foreground">{result.totalAnswers} respuestas a esta pregunta.</p>
    </div>
  );
}

export function SurveyResults({
  targetCount,
  respondedCount,
  missing,
  questionResults,
}: {
  targetCount: number;
  respondedCount: number;
  missing: { id: string; fullName: string; documentNumber: string }[];
  questionResults: SurveyQuestionResult[];
}) {
  const percentage = targetCount > 0 ? Math.round((respondedCount / targetCount) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="surface flex items-center justify-between p-4">
        <span className="font-display text-lg font-bold text-foreground">{percentage}%</span>
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Users2 className="h-4 w-4 text-primary" />
          {respondedCount} de {targetCount} respondieron
        </span>
      </div>

      {questionResults.length === 0 ? (
        <EmptyState
          icon={Users2}
          title="Sin preguntas todavía"
          description="Agrega preguntas para poder ver resultados aquí."
          className="py-10"
        />
      ) : (
        <div className="space-y-3">
          {questionResults.map((result, i) => (
            <QuestionResultCard key={i} result={result} />
          ))}
        </div>
      )}

      <div className="space-y-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <UserX className="h-4 w-4 text-destructive" />
          Personal objetivo que aún no responde ({missing.length})
        </p>
        {missing.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todo el personal objetivo ya respondió.</p>
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
                {missing.map((user) => (
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
    </div>
  );
}
