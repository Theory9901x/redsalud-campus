"use client";

import { FormularioEncuesta, type EncuestaFormulario } from "@/components/encuestas/formulario-encuesta";
import { FormularioExterno, type InstitucionFormulario } from "@/components/encuestas/formulario-externo";
import { enviarRespuestaEncuestaAction } from "@/app/encuestas/acciones-respuesta";
import type { ValorRespuesta } from "@/lib/encuestas/tipos";

/**
 * Puente entre la página (servidor) y el formulario (cliente): el formulario
 * no debe conocer la acción de servidor, para poder reutilizarlo tal cual en
 * la vista previa del constructor, donde no se guarda nada.
 *
 * Con `externo` se usa la piel de cara al usuario externo (SIAU): misma
 * acción de envío, otra presentación.
 */
export function LanzadorFormulario({
  encuesta,
  nombreRequerido,
  externo,
}: {
  encuesta: EncuestaFormulario;
  nombreRequerido: boolean;
  externo?: { codigo: string; institucion: InstitucionFormulario; modoKiosco: boolean };
}) {
  async function enviar(respuestas: Record<string, ValorRespuesta>, nombre: string | null) {
    const resultado = await enviarRespuestaEncuestaAction(encuesta.id, respuestas, nombre);
    return resultado.error;
  }

  if (externo) {
    return (
      <FormularioExterno
        encuesta={encuesta}
        codigo={externo.codigo}
        institucion={externo.institucion}
        modoKiosco={externo.modoKiosco}
        onEnviar={enviar}
      />
    );
  }
  return <FormularioEncuesta encuesta={encuesta} onEnviar={enviar} nombreRequerido={nombreRequerido} />;
}
