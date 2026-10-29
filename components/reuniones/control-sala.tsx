"use client";
import { useEffect, useState } from "react";

/** Solo el estado persistido cierra la llamada; nunca la hora prevista. */
export function ControlSalaReunion({ activityId, cerradaInicial, children, esReunion = true }: { activityId: string; cerradaInicial: boolean; children: React.ReactNode; esReunion?: boolean }) {
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
  return cerrada ? <div role="status" className="rounded-xl border bg-card p-6 text-lg font-semibold">La reunión fue cerrada por su creador o anfitrión.</div> : children;
}
