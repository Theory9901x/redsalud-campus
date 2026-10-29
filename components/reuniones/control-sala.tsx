"use client";
import { useEffect, useState } from "react";

/** Solo el estado persistido cierra la llamada; nunca la hora prevista. */
export function ControlSalaReunion({ activityId, cerradaInicial, children, gestion, esReunion = true }: { activityId: string; cerradaInicial: boolean; children: React.ReactNode; gestion?: React.ReactNode; esReunion?: boolean }) {
  const [cerrada, setCerrada] = useState(cerradaInicial);
  useEffect(() => {
    if (!esReunion) return;
    let vigente = true;
    const actualizar = async () => {
      const r = await fetch(`/api/reuniones/sala/${activityId}/estado`, { cache: "no-store" });
      if (!r.ok) return;
      const d = await r.json(); if (vigente) setCerrada(d.cerrada === true);
    };
    const cambiar = (e: Event) => { const d = (e as CustomEvent<{ activityId: string; cerrada: boolean }>).detail; if (d?.activityId === activityId) setCerrada(d.cerrada); };
    window.addEventListener("reunion:estado", cambiar);
    void actualizar().catch(() => {});
    const timer = setInterval(() => void actualizar().catch(() => {}), 10000);
    return () => { vigente = false; clearInterval(timer); window.removeEventListener("reunion:estado", cambiar); };
  }, [activityId, esReunion]);
  if (!esReunion) return children;
  return <div className="space-y-4"><p className="rounded-lg border bg-card p-3 text-base font-medium">El horario es orientativo. La reunión se mantiene abierta hasta que el anfitrión o su creador la cierre.</p>{cerrada ? <><div role="status" className="rounded-xl border bg-card p-6 text-lg font-semibold">La reunión fue cerrada por su creador o anfitrión.</div>{gestion}</> : children}</div>;
}
