import { Suspense } from "react";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/page-header";
import { DashboardPanel } from "@/components/dashboard/dashboard-kit";
import { FiltrosGlobales } from "@/components/admin/dashboard/filtros-globales";
import { Indicadores } from "@/components/admin/dashboard/indicadores";
import { EmbudoParticipacion } from "@/components/admin/dashboard/embudo-participacion";
import { CoberturaMunicipios } from "@/components/admin/dashboard/cobertura-municipios";
import { AvanceCursos } from "@/components/admin/dashboard/avance-cursos";
import { TablaPersonas } from "@/components/admin/dashboard/tabla-personas";
import { PanelPersona } from "@/components/admin/dashboard/panel-persona";
import { DetallePersona } from "@/components/admin/dashboard/detalle-persona";
import { LimiteError } from "@/components/admin/dashboard/limite-error";
import { CargandoKpis, CargandoLista, CargandoTabla } from "@/components/admin/dashboard/estados";
import { getOpcionesFiltro, hayFiltrosActivos, leerFiltros } from "@/lib/admin-dashboard";

/**
 * Panel de control de Talento Humano.
 *
 * Cada widget es un Server Component independiente dentro de su propio
 * <Suspense> y su propio <LimiteError>: se pintan a medida que sus consultas
 * terminan, en vez de esperar a que las ocho acaben para mostrar algo, y si una
 * falla degrada solo ese recuadro. Antes bastaba con que una de las consultas
 * del Promise.all reventara para dejar el panel entero en blanco.
 *
 * Todos leen los MISMOS filtros de la URL, así que no pueden contradecirse.
 */
export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filtros = leerFiltros(params);
  const { municipios, cursos } = await getOpcionesFiltro();

  const paginaCruda = Array.isArray(params.pagina) ? params.pagina[0] : params.pagina;
  const pagina = Math.max(1, Number(paginaCruda) || 1);
  const personaId = Array.isArray(params.persona) ? params.persona[0] : params.persona;

  // Se reconstruye desde los filtros ya validados, no desde `params` en crudo:
  // así un parámetro basura de la URL no viaja a los enlaces de paginación.
  const queryBase = new URLSearchParams();
  if (filtros.municipioId) queryBase.set("municipio", filtros.municipioId);
  if (filtros.personnelType) queryBase.set("personal", filtros.personnelType);
  if (filtros.courseId) queryBase.set("curso", filtros.courseId);
  if (filtros.estado) queryBase.set("estado", filtros.estado);

  // La clave fuerza a Suspense a mostrar el esqueleto otra vez cuando cambian
  // los filtros; sin ella React reutiliza el árbol y la pantalla se queda con
  // los números viejos hasta que llegan los nuevos.
  const clave = queryBase.toString();

  return (
    <div className="accent-admin space-y-5">
      <AdminPageHeader
        title="Panel de control"
        description="Estado de la formación del personal de Red Salud Casanare E.S.E."
      />

      <FiltrosGlobales municipios={municipios} cursos={cursos} />

      <LimiteError>
        <Suspense key={`kpi-${clave}`} fallback={<CargandoKpis />}>
          <Indicadores filtros={filtros} />
        </Suspense>
      </LimiteError>

      <div className="grid gap-4 xl:grid-cols-3">
        <DashboardPanel
          title="Participación"
          description="En qué punto está el personal. Haz clic en un paso para filtrar."
        >
          <LimiteError>
            <Suspense key={`embudo-${clave}`} fallback={<CargandoLista />}>
              <EmbudoParticipacion filtros={filtros} />
            </Suspense>
          </LimiteError>
        </DashboardPanel>

        <DashboardPanel title="Cobertura por municipio" description="De menor a mayor cumplimiento.">
          <LimiteError>
            <Suspense key={`cobertura-${clave}`} fallback={<CargandoLista filas={5} />}>
              <CoberturaMunicipios filtros={filtros} municipios={municipios} />
            </Suspense>
          </LimiteError>
        </DashboardPanel>

        <DashboardPanel title="Avance por curso" description="Cuánto de cada curso está terminado.">
          <LimiteError>
            <Suspense key={`cursos-${clave}`} fallback={<CargandoLista filas={3} />}>
              <AvanceCursos filtros={filtros} />
            </Suspense>
          </LimiteError>
        </DashboardPanel>
      </div>

      <DashboardPanel
        title="Detalle del personal"
        description={
          hayFiltrosActivos(filtros)
            ? "Resultado de los filtros aplicados. Haz clic en una fila para ver la ficha."
            : "Ordenado por quién necesita atención primero. Haz clic en una fila para ver la ficha."
        }
        action={
          <Link href="/admin/reportes" className="btn-hud-ghost shrink-0 py-1.5 text-xs">
            Ver reportes completos
          </Link>
        }
      >
        <LimiteError>
          <Suspense key={`tabla-${clave}-${pagina}`} fallback={<CargandoTabla />}>
            <TablaPersonas filtros={filtros} pagina={pagina} queryBase={queryBase} />
          </Suspense>
        </LimiteError>
      </DashboardPanel>

      {/* Panel lateral: abierto cuando la URL trae ?persona=<id>. */}
      <PanelPersona>
        {personaId && (
          <LimiteError>
            <Suspense key={personaId} fallback={<CargandoTabla filas={4} />}>
              <DetallePersona id={personaId} />
            </Suspense>
          </LimiteError>
        )}
      </PanelPersona>
    </div>
  );
}
