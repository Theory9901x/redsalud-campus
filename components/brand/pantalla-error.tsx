"use client";

import { useEffect, useState } from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";

const MARCA_RECARGA = "campus:recarga-por-version";

/**
 * ¿El error viene de una pestaña que quedó abierta de ANTES de una
 * actualización del campus? Son dos casos: el formulario llama a una acción
 * que el servidor nuevo ya no reconoce, o el navegador pide un trozo de código
 * de la versión anterior. Ninguno es un fallo real: se arregla recargando.
 */
function esVersionVieja(error: Error) {
  if (error.name === "UnrecognizedActionError" || error.name === "ChunkLoadError") return true;
  return /Server Action .* was not found|Failed to find Server Action|Loading chunk|Failed to load chunk|dynamically imported module/i.test(
    error.message ?? ""
  );
}

/**
 * Pantalla de error del campus (la usan app/error.tsx y app/global-error.tsx).
 *
 * Antes no había ninguna y Next mostraba la suya, en inglés: "This page
 * couldn't load". Casi siempre salía tras un despliegue, en el login o al
 * guardar un formulario, porque la pestaña seguía con la versión anterior.
 * Ahora ese caso se recarga solo -una vez, para no entrar en bucle si el
 * problema es otro- y lo demás se explica en español con un botón claro.
 */
export function PantallaError({ error, reintentar }: { error: Error & { digest?: string }; reintentar: () => void }) {
  // Se decide tras montar: sessionStorage no existe en el servidor.
  const [recargando, setRecargando] = useState(() => esVersionVieja(error));

  useEffect(() => {
    if (!esVersionVieja(error)) return;
    let ultima = 0;
    try {
      ultima = Number(sessionStorage.getItem(MARCA_RECARGA) ?? 0);
      // Una sola recarga automática por minuto: si tras recargar vuelve a
      // fallar, el problema no era la versión y hay que mostrar la pantalla.
      if (Date.now() - ultima > 60_000) {
        sessionStorage.setItem(MARCA_RECARGA, String(Date.now()));
        window.location.reload();
        return;
      }
    } catch {
      // Sin sessionStorage (modo privado estricto) no hay cómo evitar el
      // bucle, así que no se recarga sola: queda el botón.
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- depende de sessionStorage, que solo existe en el navegador.
    setRecargando(false);
  }, [error]);

  if (recargando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
        <p className="flex items-center gap-3 text-sm text-muted-foreground" role="status">
          <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
          Actualizando el campus a la última versión…
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-[var(--shadow-2)]">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-warning/20 text-warning-foreground">
          <TriangleAlert className="h-6 w-6" aria-hidden="true" />
        </span>
        <h1 className="mt-4 font-display text-2xl font-extrabold tracking-tight">No pudimos cargar esta página</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Suele pasar cuando el campus se actualizó mientras tenías la página abierta, o por un corte momentáneo de
          conexión. Recarga para continuar; tu sesión sigue activa.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button type="button" onClick={() => window.location.reload()} className="btn-acceso sm:w-auto sm:px-6">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Recargar la página
          </button>
          <button
            type="button"
            onClick={reintentar}
            className="h-[3.25rem] rounded-xl border border-border px-5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
          >
            Reintentar
          </button>
        </div>
        {error.digest && <p className="mt-5 text-xs text-muted-foreground">Código de referencia: {error.digest}</p>}
      </div>
    </div>
  );
}
