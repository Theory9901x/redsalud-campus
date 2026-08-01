"use client";

import { useState } from "react";

/**
 * Ejecuta algo cuando una acción de servidor ACABA de terminar bien.
 *
 * El patrón que sustituye era este, repetido en media docena de diálogos:
 *
 *   useEffect(() => {
 *     if (state.success) setOpen(false);
 *   }, [state]);
 *
 * Funcionaba, pero provoca un render en cascada: el componente pinta una vez
 * con el diálogo aún abierto, corre el efecto, y vuelve a pintar para
 * cerrarlo. Con un formulario es imperceptible; el problema es que es el
 * patrón que se copia, y en una lista o un árbol grande sí se nota.
 *
 * Aquí el ajuste se hace durante el render comparando la identidad del estado
 * -useActionState devuelve un objeto nuevo en cada envío-, que es lo que React
 * documenta para derivar estado de props cambiantes. Solo reacciona a un
 * estado que no se haya visto antes, así que un re-render por cualquier otro
 * motivo no vuelve a disparar la acción.
 */
export function useAlTenerExito<T extends { success?: boolean }>(
  state: T,
  alTenerExito: () => void
) {
  const [ultimoVisto, setUltimoVisto] = useState(state);

  if (state !== ultimoVisto) {
    setUltimoVisto(state);
    if (state.success) alTenerExito();
  }
}
