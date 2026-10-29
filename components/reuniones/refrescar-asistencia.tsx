"use client";
import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
export function RefrescarAsistencia({ abierta }: { abierta: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  useEffect(() => {
    if (!abierta) return;
    const timer = setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, 30000);
    return () => clearInterval(timer);
  }, [abierta, router]);
  return <button type="button" disabled={pending} onClick={() => start(() => router.refresh())} className="rounded-lg border px-3 py-2 text-sm font-semibold">{pending ? "Actualizando…" : "Actualizar asistencia"}</button>;
}
