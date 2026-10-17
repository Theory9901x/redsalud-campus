import { TIPOS_DOCUMENTO, tiposDocumentoPara, type ContextoDocumento, type TipoDocumento } from "@/lib/documentos";

/**
 * Campos de la FICHA que acompañan a todo archivo que se sube: qué documento
 * es y una descripción corta. Van dentro de cualquier formulario de carga.
 *
 * `contexto` decide qué tipos se ofrecen: en una capacitación o un plan de
 * capacitación no hay «Acta» ni «Resolución / normativa» (esas son de
 * comités y reuniones).
 */
export function CamposFichaDocumento({
  tipoFijo,
  tipoInicial = "MATERIAL",
  contexto,
}: {
  tipoFijo?: TipoDocumento;
  tipoInicial?: TipoDocumento;
  contexto: ContextoDocumento;
}) {
  const opciones = tiposDocumentoPara(contexto);
  const inicial = opciones.some(([k]) => k === tipoInicial) ? tipoInicial : "MATERIAL";
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,13rem)_1fr]">
      <label className="block space-y-1.5">
        <span className="block">Tipo de documento</span>
        {tipoFijo ? (
          <>
            <input type="hidden" name="kind" value={tipoFijo} />
            <input value={TIPOS_DOCUMENTO[tipoFijo]} readOnly className="w-full opacity-80" />
          </>
        ) : (
          <select name="kind" defaultValue={inicial} className="w-full">
            {opciones.map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        )}
      </label>
      <label className="block space-y-1.5">
        <span className="block">Descripción</span>
        <input name="description" maxLength={200} placeholder="Ej. Lista firmada de la jornada del 14 de octubre" className="w-full" />
      </label>
    </div>
  );
}
