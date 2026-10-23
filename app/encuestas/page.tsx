import Link from "next/link";
import { Activity, ClipboardList, LayoutTemplate, Plus } from "lucide-react";
import { requireSession } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { listarEncuestas, type AlcanceEncuestas } from "@/lib/encuestas/consultas";
import { TarjetaEncuesta } from "@/components/encuestas/tarjeta-encuesta";
import { FiltrosEncuestasBarra } from "@/components/encuestas/filtros-encuestas";
import { EmptyState } from "@/components/brand/empty-state";
import { ModuloHero } from "@/components/training-plans/modulo-hero";
import { Cifra, FocoCursor } from "@/components/training-plans/plan-dinamico";
import { Segmento } from "@/components/encuestas/ficha-encuesta";
import { cn } from "@/lib/utils";
import type { SurveyStatus, SurveyAudience } from "@prisma/client";
import { veComoAdmin } from "@/lib/roles";
import { puedeGestionarSiau } from "@/lib/encuestas/acceso-siau";
import { CODIGO_SIAU } from "@/lib/encuestas/metrics";

/**
 * ESPACIO DE TRABAJO DE ENCUESTAS.
 *
 * Lo ven los tres roles, con alcances distintos y a propósito:
 *
 *  - Administrador: todas las encuestas de la plataforma.
 *  - Tutor: solo las de satisfacción de las capacitaciones de sus áreas
 *    (opcionales: el área las crea si lo desea). Nunca la encuesta SIAU ni
 *    el Centro de datos SIAU, que son del área de Atención al Usuario.
 *    Única excepción: la cuenta de esa área (puedeGestionarSiau), que además
 *    ve la encuesta SIAU -para consultarla y exportarla, sin «Editar»- y el
 *    acceso al Centro de datos SIAU.
 *  - Estudiante: únicamente aquellas que respondió, con su propio resultado.
 *    Nunca ve la encuesta de otra persona ni resultados agregados.
 */
export default async function EncuestasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string; audiencia?: string; vista?: string; area?: string; capacitacion?: string }>;
}) {
  const { q, estado, audiencia, vista, area, capacitacion } = await searchParams;
  const sesion = await requireSession("/encuestas");
  const rol = sesion.user.role;
  const esTutor = rol === "TUTOR";
  const esGestor = veComoAdmin(rol) || esTutor;
  // Administrador o cuenta del área SIAU: ven la encuesta y el Centro de datos.
  const veSiau = esGestor && (await puedeGestionarSiau(sesion));

  const alcance: AlcanceEncuestas =
    veComoAdmin(rol)
      ? { tipo: "todas" }
      : rol === "TUTOR"
        ? {
            tipo: "emitidas",
            userId: sesion.user.id,
            areaIds: (
              await prisma.trainingArea.findMany({ where: { tutorId: sesion.user.id }, select: { id: true } })
            ).map((a) => a.id),
            incluirSiau: veSiau,
          }
        : { tipo: "respondidas", userId: sesion.user.id };

  // Opciones de los filtros por área y capacitación (solo gestores): las
  // mismas fronteras de alcance que el listado.
  const [areasFiltro, actividadesFiltro] = esGestor
    ? await Promise.all([
        prisma.trainingArea.findMany({
          where: veComoAdmin(rol) ? {} : { tutorId: sesion.user.id },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        }),
        prisma.trainingActivity.findMany({
          where: {
            surveys: { some: {} },
            ...(veComoAdmin(rol) ? {} : { area: { tutorId: sesion.user.id } }),
          },
          select: { id: true, title: true },
          orderBy: { title: "asc" },
        }),
      ])
    : [[], []];

  // Las plantillas son institucionales: el tutor parte de ellas al crear su
  // encuesta (en /encuestas/nueva), no las administra aquí.
  const verPlantillas = veComoAdmin(rol) && vista === "plantillas";
  const encuestas = await listarEncuestas(
    {
      buscar: q,
      estado: estado as SurveyStatus | undefined,
      audiencia: audiencia as SurveyAudience | undefined,
      areaId: area || undefined,
      actividadId: capacitacion || undefined,
      plantillas: verPlantillas,
    },
    alcance
  );

  // Cifras de la cabecera. Se calculan sobre lo que esta persona puede ver,
  // no sobre toda la plataforma: a un tutor no le sirve el total institucional.
  const publicadas = encuestas.filter((e) => e.status === "PUBLISHED").length;
  const borradores = encuestas.filter((e) => e.status === "DRAFT").length;
  const cerradas = encuestas.filter((e) => e.status === "CLOSED").length;
  const respuestas = encuestas.reduce((s, e) => s + e.completadas, 0);
  const iniciadas = encuestas.reduce((s, e) => s + e.respuestas, 0);
  const finalizacion = iniciadas > 0 ? Math.round((respuestas / iniciadas) * 100) : null;
  const hayFiltros = Boolean(q || estado || audiencia || area || capacitacion);

  const cifras = esGestor
    ? [
        { valor: encuestas.length, etiqueta: verPlantillas ? "Plantillas" : "Encuestas", detalle: `${borradores} en borrador` },
        { valor: publicadas, etiqueta: "Publicadas", detalle: `${cerradas} ${cerradas === 1 ? "cerrada" : "cerradas"}` },
        { valor: respuestas, etiqueta: "Respuestas", detalle: `${iniciadas} iniciadas` },
        {
          valor: finalizacion !== null ? <Cifra valor={finalizacion} sufijo="%" /> : "—",
          etiqueta: "Finalización",
          detalle: "completas ÷ iniciadas",
        },
      ]
    : [{ valor: encuestas.length, etiqueta: "Encuestas respondidas" }];

  return (
    // El shell del estudiante no trae margen propio; el de admin y tutor sí.
    <div className={cn("space-y-5", !esGestor && "mx-auto w-full max-w-[1480px] px-4 py-6 sm:px-6 lg:px-8")}>
      <ModuloHero
        eyebrow="Módulo de encuestas"
        Icono={ClipboardList}
        titulo={esTutor ? "Satisfacción de" : esGestor ? "Encuestas" : "Mis"}
        acento={esTutor ? "tus capacitaciones" : esGestor ? "institucionales" : "respuestas"}
        descripcion={
          esTutor
            ? "Si el área así lo desea, mide la satisfacción de cada capacitación con una encuesta corta: se adscribe a la capacitación, se publica con su enlace y su QR, y aquí consultas sus resultados. Es opcional."
            : esGestor
              ? "Construye encuestas por bloques, publícalas con un enlace estable y su QR, y consulta los resultados y sus exportables en un solo lugar."
              : "Aquí queda constancia de las encuestas que has respondido, con el resultado de cada una."
        }
        cifras={cifras}
        acciones={
          esGestor && (
            <>
              <Link href="/encuestas/nueva" className="boton-hero">
                <Plus className="h-4 w-4" aria-hidden="true" />
                {esTutor ? "Nueva encuesta de satisfacción" : "Nueva encuesta"}
              </Link>
              {veSiau && (
                <Link href="/encuestas/siau" className="enlace-hero">
                  <Activity className="h-4 w-4" aria-hidden="true" />
                  Centro de datos SIAU
                </Link>
              )}
            </>
          )
        }
      />

      {esGestor && (
        <div className="barra-modulo p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {esTutor ? (
              <p className="text-[12.5px] text-muted-foreground">
                Encuestas de satisfacción adscritas a las capacitaciones de tu área{veSiau ? " y la Encuesta de Atención al Usuario (SIAU)" : ""}.
              </p>
            ) : (
              <Segmento
                etiqueta="Vista del listado"
                items={[
                  { href: "/encuestas", etiqueta: "Encuestas", Icono: ClipboardList, activo: !verPlantillas, conteo: !verPlantillas ? encuestas.length : undefined },
                  { href: "/encuestas?vista=plantillas", etiqueta: "Plantillas", Icono: LayoutTemplate, activo: verPlantillas, conteo: verPlantillas ? encuestas.length : undefined },
                ]}
              />
            )}
            <p className="mono-label flex items-center gap-2">
              <span className="punto-vivo text-primary" aria-hidden="true" />
              {encuestas.length} {encuestas.length === 1 ? "resultado" : "resultados"}
              {hayFiltros ? " · con filtros" : ""}
            </p>
          </div>
          <div className="mt-4 border-t border-border/60 pt-4">
            <FiltrosEncuestasBarra
              areas={areasFiltro.map((a) => ({ id: a.id, nombre: a.name }))}
              actividades={actividadesFiltro.map((a) => ({ id: a.id, titulo: a.title }))}
            />
          </div>
        </div>
      )}

      <section aria-label={esGestor ? (verPlantillas ? "Plantillas" : "Encuestas") : "Mis encuestas"}>
        {encuestas.length === 0 ? (
          <div className="barra-modulo">
            <EmptyState
              icon={ClipboardList}
              title={
                esGestor
                  ? hayFiltros
                    ? "Ninguna encuesta coincide con los filtros"
                    : verPlantillas
                      ? "Sin plantillas todavía"
                      : esTutor
                        ? "Sin encuestas de satisfacción todavía"
                        : "Sin encuestas todavía"
                  : "Aún no has respondido ninguna encuesta"
              }
              description={
                esGestor
                  ? hayFiltros
                    ? "Ajusta o limpia los filtros para ver más resultados."
                    : esTutor
                      ? "Son opcionales. Si el área lo desea, crea una con «Nueva encuesta de satisfacción» y adscríbela a la capacitación."
                      : "Crea la primera con «Nueva encuesta» y publícala con su enlace y su código QR."
                  : "Cuando respondas una, aparecerá aquí con tu resultado."
              }
              className="py-16"
            />
          </div>
        ) : (
          <FocoCursor className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {encuestas.map((e, i) => (
              <TarjetaEncuesta
                key={e.id}
                encuesta={e}
                puedeGestionar={esGestor}
                // La cuenta SIAU consulta y exporta su encuesta; su estructura no la edita.
                puedeEditar={!(esTutor && e.code.startsWith(CODIGO_SIAU))}
                baseUrl="/encuestas"
                indice={i}
              />
            ))}
          </FocoCursor>
        )}
      </section>
    </div>
  );
}
