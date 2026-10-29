export type AsistenteSesion = {
  clave: string; nombre: string; cargo: string; registradoEl: Date | null; salidaEl: Date | null;
  segundos: number; minutos: number; conexiones: number; tipo: "registro" | "cuenta";
  estado: "En sala" | "Finalizó" | "Sin cierre registrado";
};
export type TramoAsistencia = {
  userId: string | null; externalParticipantId: string | null; displayName: string;
  joinedAt: Date; leftAt: Date; durationSeconds: number; event: string;
  user: { fullName: string; position: string | null } | null;
  externalParticipant: { fullName: string; company: string } | null;
};

/** Una fila por identidad que realmente entró. Los intervalos superpuestos no se suman dos veces. */
export function consolidarAsistencia(tramos: TramoAsistencia[], ahora = new Date(), cerradaEl: Date | null = null): AsistenteSesion[] {
  const grupos = new Map<string, TramoAsistencia[]>();
  for (const t of tramos) {
    const id = t.userId ?? t.externalParticipantId;
    if (!id || (cerradaEl && t.joinedAt > cerradaEl)) continue;
    const lista = grupos.get(id) ?? []; lista.push(t); grupos.set(id, lista);
  }
  return [...grupos].map(([clave, rows]) => {
    rows.sort((a, b) => +a.leftAt - +b.leftAt);
    const first = rows.reduce((a, b) => a.joinedAt < b.joinedAt ? a : b);
    const last = rows[rows.length - 1];
    const intervalos = rows.filter(t => t.durationSeconds > 0).map(t => [+t.joinedAt, Math.min(+t.leftAt, +(cerradaEl ?? ahora))] as [number, number]).filter(([a, b]) => b > a).sort((a, b) => a[0] - b[0]);
    const unidos: [number, number][] = [];
    for (const [a, b] of intervalos) { const previo = unidos[unidos.length - 1]; if (previo && a <= previo[1] + 1000) previo[1] = Math.max(previo[1], b); else unidos.push([a, b]); }
    const segundos = Math.floor(unidos.reduce((n, [a, b]) => n + b - a, 0) / 1000);
    const joins = rows.filter(t => t.event === "JOIN").length;
    return { clave, nombre: first.user?.fullName ?? first.externalParticipant?.fullName ?? first.displayName,
      cargo: first.user?.position || first.externalParticipant?.company || "Sin cargo registrado",
      registradoEl: first.joinedAt, salidaEl: last.event === "LEAVE" ? last.leftAt : null,
      segundos, minutos: Math.round(segundos / 6) / 10, conexiones: joins || Math.max(1, unidos.length),
      tipo: first.userId ? "cuenta" as const : "registro" as const,
      estado: last.event === "LEAVE" ? "Finalizó" as const : !cerradaEl && +ahora - +last.leftAt < 120000 ? "En sala" as const : "Sin cierre registrado" as const,
    };
  }).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}
