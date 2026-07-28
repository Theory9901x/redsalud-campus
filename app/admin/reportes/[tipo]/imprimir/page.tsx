import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { ESTADO_FORMACION_LABEL } from "@/lib/formacion";
import { leerFiltros } from "@/lib/admin-dashboard";
import {
  REPORTE_META,
  describirFiltros,
  esTipoReporte,
  getDatosReporte,
} from "@/lib/reportes-imprimibles";

/**
 * Hoja imprimible de un reporte.
 *
 * Es una página normal, no un formato aparte: el administrador puede abrirla y
 * hacer Ctrl+P sin depender de ningún servicio, y es exactamente lo que el
 * generador de PDF renderiza. Un solo formato que mantener, no dos.
 *
 * Aquí SÍ mandan los colores institucionales (--rs-*): esto es un documento
 * con membrete de la E.S.E., no una interfaz. Se imprime siempre en claro,
 * pase lo que pase con el tema de la aplicación.
 */
export default async function ImprimirReportePage({
  params,
  searchParams,
}: {
  params: Promise<{ tipo: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") notFound();

  const { tipo } = await params;
  if (!esTipoReporte(tipo)) notFound();

  const sp = await searchParams;
  const filtros = leerFiltros(sp);
  const [datos, glosaFiltros] = await Promise.all([getDatosReporte(tipo, filtros), describirFiltros(filtros)]);
  const meta = REPORTE_META[tipo];

  const generado = new Date().toLocaleDateString("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="hoja-impresa">
      {/* Membrete institucional */}
      <header className="hoja-membrete">
        <div className="flex items-center gap-3">
          {datos.encabezado.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={datos.encabezado.logoUrl} alt="" className="h-12 w-auto" />
          )}
          <div>
            <p className="hoja-institucion">{datos.encabezado.institucion}</p>
            <p className="hoja-sub">{datos.encabezado.ciudad}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="hoja-sub">Generado el {generado}</p>
          <p className="hoja-sub">Por {session.user.name}</p>
        </div>
      </header>

      <h1 className="hoja-titulo">{meta.titulo}</h1>
      <p className="hoja-descripcion">{meta.descripcion}</p>
      <p className="hoja-glosa">{glosaFiltros}</p>

      {/* Indicadores: van en todos los tipos, para que cualquier hoja suelta
          conserve el contexto del que salió. */}
      <section className="hoja-seccion">
        <h2 className="hoja-h2">Indicadores</h2>
        <table className="hoja-kpis">
          <tbody>
            <tr>
              <td>
                <span className="hoja-cifra">{datos.indicadores.personas}</span>
                <span className="hoja-etiqueta">Personas activas</span>
              </td>
              <td>
                <span className="hoja-cifra">{datos.indicadores.inscripciones}</span>
                <span className="hoja-etiqueta">Inscripciones</span>
              </td>
              <td>
                <span className="hoja-cifra">
                  {datos.indicadores.porcentajeCompletado !== null
                    ? `${datos.indicadores.porcentajeCompletado}%`
                    : "—"}
                </span>
                <span className="hoja-etiqueta">Formación completada</span>
              </td>
              <td>
                <span className="hoja-cifra">{datos.indicadores.sinIngresar}</span>
                <span className="hoja-etiqueta">Nunca han ingresado</span>
              </td>
              <td>
                <span className="hoja-cifra">{datos.indicadores.certificados}</span>
                <span className="hoja-etiqueta">Certificados</span>
              </td>
              <td>
                <span className="hoja-cifra">
                  {datos.indicadores.promedioAprobacion !== null
                    ? `${datos.indicadores.promedioAprobacion}%`
                    : "—"}
                </span>
                <span className="hoja-etiqueta">Promedio aprobación</span>
              </td>
            </tr>
          </tbody>
        </table>
        {datos.indicadores.promedioAprobacion === null && (
          <p className="hoja-nota">
            El promedio de aprobación aparece como «—» porque todavía no hay ninguna evaluación aprobada de la
            que calcularlo. No equivale a 0 %.
          </p>
        )}
      </section>

      {/* Participación */}
      {"embudo" in datos && datos.embudo && (
        <section className="hoja-seccion">
          <h2 className="hoja-h2">Participación</h2>
          <table className="hoja-tabla">
            <thead>
              <tr>
                <th>Estado</th>
                <th className="num">Personas</th>
                <th className="num">Proporción</th>
              </tr>
            </thead>
            <tbody>
              {datos.embudo.map((paso) => {
                const total = datos.embudo.reduce((a, p) => a + p.personas, 0);
                return (
                  <tr key={paso.estado}>
                    <td>{ESTADO_FORMACION_LABEL[paso.estado]}</td>
                    <td className="num">{paso.personas}</td>
                    <td className="num">{total > 0 ? Math.round((paso.personas / total) * 100) : 0}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {/* Cobertura */}
      {"cobertura" in datos && datos.cobertura && datos.cobertura.length > 0 && (
        <section className="hoja-seccion">
          <h2 className="hoja-h2">Cobertura por municipio</h2>
          <table className="hoja-tabla">
            <thead>
              <tr>
                <th>Municipio</th>
                <th className="num">Personas</th>
                <th className="num">Completaron</th>
                <th className="num">Cumplimiento</th>
              </tr>
            </thead>
            <tbody>
              {datos.cobertura.map((fila) => (
                <tr key={fila.municipio}>
                  <td>{fila.municipio}</td>
                  <td className="num">{fila.personas}</td>
                  <td className="num">{fila.completaron}</td>
                  <td className="num">
                    {fila.personas > 0 ? Math.round((fila.completaron / fila.personas) * 100) : 0}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Avance por curso */}
      {"cursos" in datos && datos.cursos && datos.cursos.length > 0 && (
        <section className="hoja-seccion">
          <h2 className="hoja-h2">Avance por curso</h2>
          <table className="hoja-tabla">
            <thead>
              <tr>
                <th>Curso</th>
                <th className="num">Inscritos</th>
                <th className="num">En curso</th>
                <th className="num">Completados</th>
              </tr>
            </thead>
            <tbody>
              {datos.cursos.map((c) => (
                <tr key={c.courseId}>
                  <td>{c.titulo}</td>
                  <td className="num">{c.inscritos}</td>
                  <td className="num">{c.enCurso}</td>
                  <td className="num">{c.completados}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Listado nominal */}
      {"personas" in datos && datos.personas && (
        <section className="hoja-seccion">
          <h2 className="hoja-h2">Listado nominal ({datos.totalPersonas})</h2>
          <table className="hoja-tabla">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Documento</th>
                <th>Municipio</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th className="num">Avance</th>
              </tr>
            </thead>
            <tbody>
              {datos.personas.map((p) => (
                <tr key={p.id}>
                  <td>{p.fullName}</td>
                  <td>{p.documentNumber}</td>
                  <td>{p.municipio ?? "—"}</td>
                  <td>{p.personnelType === "ASISTENCIAL" ? "Asistencial" : "Administrativo"}</td>
                  <td>{ESTADO_FORMACION_LABEL[p.estado]}</td>
                  <td className="num">{p.avance}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {datos.encabezado.firmante && (
        <footer className="hoja-firma">
          <div className="hoja-linea-firma" />
          <p className="hoja-firmante">{datos.encabezado.firmante}</p>
          {datos.encabezado.cargoFirmante && <p className="hoja-sub">{datos.encabezado.cargoFirmante}</p>}
          <p className="hoja-sub">{datos.encabezado.institucion}</p>
        </footer>
      )}
    </div>
  );
}
