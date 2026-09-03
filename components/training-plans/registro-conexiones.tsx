import { PhoneCall, Timer, UserPlus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { etiquetaFecha, etiquetaHora } from "@/components/training-plans/labels";

function formatoDuracion(seg: number): string {
  const min = Math.round(seg / 60);
  if (min < 1) return "menos de 1 min";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return `${h} h ${min % 60} min`;
}

/**
 * REGISTRO DE CONEXIONES de la capacitación, como base de datos: una fila
 * por persona con primer ingreso, última salida, tiempo total conectado y
 * cuántas veces entró, consolidando todos los tramos de todas sus jornadas.
 * Es la trazabilidad completa de la sala; la vista de una jornada concreta
 * muestra lo mismo acotado a su franja.
 */
export async function RegistroConexiones({ activityId }: { activityId: string }) {
  const tramos = await prisma.callConnectionLog.findMany({
    where: { activityId },
    orderBy: { joinedAt: "asc" },
    select: {
      displayName: true,
      joinedAt: true,
      leftAt: true,
      durationSeconds: true,
      userId: true,
      externalParticipantId: true,
      user: { select: { fullName: true, documentNumber: true } },
      externalParticipant: { select: { fullName: true, company: true } },
    },
  });

  type Consolidado = {
    nombre: string;
    documento: string | null;
    empresa: string | null;
    externo: boolean;
    primerIngreso: Date;
    ultimaSalida: Date;
    segundos: number;
    ingresos: number;
  };
  const porPersona = new Map<string, Consolidado>();
  for (const t of tramos) {
    const clave = t.userId ?? (t.externalParticipantId ? `ext:${t.externalParticipantId}` : `nom:${t.displayName}`);
    const previo = porPersona.get(clave);
    if (previo) {
      previo.segundos += t.durationSeconds;
      previo.ingresos += 1;
      if (t.leftAt > previo.ultimaSalida) previo.ultimaSalida = t.leftAt;
    } else {
      porPersona.set(clave, {
        nombre: t.user?.fullName ?? t.externalParticipant?.fullName ?? t.displayName,
        documento: t.user?.documentNumber ?? null,
        empresa: t.externalParticipant?.company ?? null,
        externo: !t.userId,
        primerIngreso: t.joinedAt,
        ultimaSalida: t.leftAt,
        segundos: t.durationSeconds,
        ingresos: 1,
      });
    }
  }
  const conexiones = [...porPersona.values()];
  const totalSegundos = conexiones.reduce((s, c) => s + c.segundos, 0);
  const externos = conexiones.filter((c) => c.externo).length;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-xl font-bold tracking-tight text-foreground">
          <PhoneCall className="h-4 w-4 text-primary" aria-hidden="true" />
          Registro de conexiones a la sala
        </h2>
        {conexiones.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/12 px-3 py-1 text-[12px] font-bold tabular-nums text-primary">
              <PhoneCall className="h-3.5 w-3.5" aria-hidden="true" />
              {conexiones.length} {conexiones.length === 1 ? "persona" : "personas"}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1 text-[12px] font-bold tabular-nums text-success">
              <Timer className="h-3.5 w-3.5" aria-hidden="true" />
              {formatoDuracion(totalSegundos)} acumulados
            </span>
            {externos > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/18 px-3 py-1 text-[12px] font-bold tabular-nums text-warning-foreground">
                <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                {externos} {externos === 1 ? "invitado" : "invitados"}
              </span>
            )}
          </div>
        )}
      </div>

      {conexiones.length === 0 ? (
        <p className="surface p-4 text-sm text-muted-foreground">
          Nadie se ha conectado a la sala de esta capacitación todavía. Cada tramo se registra cuando la persona sale
          de la llamada o cierra la pestaña.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card/70 shadow-sm backdrop-blur-sm">
          <table className="w-full min-w-[720px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-border/60 bg-muted/40">
                {["#", "Participante", "Documento", "Día", "Primer ingreso", "Última salida", "Tiempo conectado", "Ingresos"].map((c) => (
                  <th
                    key={c}
                    className="whitespace-nowrap px-4 py-3 text-left text-[10.5px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {conexiones.map((c, i) => (
                <tr key={i} className="transition-colors hover:bg-primary/[0.04]">
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-foreground">{c.nombre}</span>
                    {c.externo && (
                      <span className="ml-2 rounded-md bg-warning/15 px-1.5 py-0.5 text-[10.5px] font-bold text-warning-foreground">
                        Invitado{c.empresa ? ` · ${c.empresa}` : ""}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">{c.documento ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{etiquetaFecha(c.primerIngreso)}</td>
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums">{etiquetaHora(c.primerIngreso)}</td>
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums">{etiquetaHora(c.ultimaSalida)}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums text-foreground">{formatoDuracion(c.segundos)}</td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">{c.ingresos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
