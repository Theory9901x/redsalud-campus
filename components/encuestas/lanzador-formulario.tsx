"use client";

import { FormularioEncuesta, type EncuestaFormulario } from "@/components/encuestas/formulario-encuesta";
import { enviarRespuestaEncuestaAction } from "@/app/encuestas/acciones-respuesta";
import type { ValorRespuesta } from "@/lib/encuestas/tipos";

/**
 * Puente entre la página (servidor) y el formulario (cliente): el formulario
 * no debe conocer la acción de servidor, para poder reutilizarlo tal cual en
 * la vista previa del constructor, donde no se guarda nada.
 */
export function LanzadorFormulario({
  encuesta,
  nombreRequerido,
}: {
  encuesta: EncuestaFormulario;
  nombreRequerido: boolean;
}) {
  async function enviar(respuestas: Record<string, ValorRespuesta>, nombre: string | null) {
    const resultado = await enviarRespuestaEncuestaAction(encuesta.id, respuestas, nombre);
    return resultado.error;
  }

  return <FormularioEncuesta encuesta={encuesta} onEnviar={enviar} nombreRequerido={nombreRequerido} />;
}
