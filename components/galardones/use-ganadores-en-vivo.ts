"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GanadoresIps } from "@/lib/galardones/consultas";

/** Cada cuánto se vuelve a consultar mientras la pestaña está a la vista. */
export const CADA_CONSULTA_GANADORES = 8000;

/**
 * Ganadores por centro EN VIVO para la ceremonia: arranca con lo que trajo el
 * servidor y vuelve a consultar cada pocos segundos, en cuanto la pestaña
 * vuelve a estar a la vista y cuando se pulsa «Actualizar». Solo cambia la
 * referencia si los datos cambiaron, para no re-renderizar (ni reiniciar
 * animaciones) sin motivo. `fallo` avisa si la consulta no está llegando,
 * para que nadie proyecte datos viejos creyendo que son los de ahora.
 */
export function useGanadoresEnVivo(inicial: GanadoresIps[]) {
  const [datos, setDatos] = useState(inicial);
  const [actualizado, setActualizado] = useState(() => new Date());
  const [cargando, setCargando] = useState(false);
  const [fallo, setFallo] = useState(false);
  const firma = useRef(JSON.stringify(inicial));
  const enCurso = useRef(false);
  const vivo = useRef(true);

  const traer = useCallback(async (manual = false) => {
    if (enCurso.current || (!manual && document.visibilityState !== "visible")) return;
    enCurso.current = true;
    if (manual) setCargando(true);
    try {
      const res = await fetch("/api/galardones/punteo", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const r = (await res.json()) as GanadoresIps[];
      if (!vivo.current) return;
      const f = JSON.stringify(r);
      if (f !== firma.current) {
        firma.current = f;
        setDatos(r);
      }
      setActualizado(new Date());
      setFallo(false);
    } catch {
      if (vivo.current) setFallo(true); // se reintenta en la próxima vuelta
    } finally {
      enCurso.current = false;
      if (manual && vivo.current) setCargando(false);
    }
  }, []);

  useEffect(() => {
    vivo.current = true;
    const alVolver = () => {
      if (document.visibilityState === "visible") void traer();
    };
    const t = setInterval(() => void traer(), CADA_CONSULTA_GANADORES);
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("focus", alVolver);
    return () => {
      vivo.current = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener("focus", alVolver);
    };
  }, [traer]);

  const refrescar = useCallback(() => void traer(true), [traer]);
  return { datos, actualizado, cargando, fallo, refrescar };
}
