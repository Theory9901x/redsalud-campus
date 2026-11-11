"use client";

import { useEffect, useRef, useState } from "react";
import { punteoCeremonia } from "@/app/galardones/acciones";
import type { GanadoresIps } from "@/lib/galardones/consultas";

/** Cada cuánto se vuelve a consultar mientras la pestaña está a la vista. */
export const CADA_CONSULTA_GANADORES = 8000;

/**
 * Ganadores por centro EN VIVO para la ceremonia: arranca con lo que trajo el
 * servidor y vuelve a consultar cada pocos segundos, y en cuanto la pestaña
 * vuelve a estar a la vista. Solo cambia la referencia si los datos cambiaron,
 * para no re-renderizar (ni reiniciar animaciones) sin motivo.
 */
export function useGanadoresEnVivo(inicial: GanadoresIps[]) {
  const [datos, setDatos] = useState(inicial);
  const [actualizado, setActualizado] = useState(() => new Date());
  const firma = useRef(JSON.stringify(inicial));

  useEffect(() => {
    let vivo = true;
    let enCurso = false;
    const traer = async () => {
      if (enCurso || document.visibilityState !== "visible") return;
      enCurso = true;
      try {
        const r = await punteoCeremonia();
        if (!vivo) return;
        const f = JSON.stringify(r);
        if (f !== firma.current) {
          firma.current = f;
          setDatos(r);
        }
        setActualizado(new Date());
      } catch {
        /* se reintenta en la próxima vuelta */
      } finally {
        enCurso = false;
      }
    };
    const alVolver = () => {
      if (document.visibilityState === "visible") void traer();
    };
    const t = setInterval(traer, CADA_CONSULTA_GANADORES);
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("focus", alVolver);
    return () => {
      vivo = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener("focus", alVolver);
    };
  }, []);

  return { datos, actualizado };
}
