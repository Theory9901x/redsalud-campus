"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Activity, BookOpenText, ClipboardList, FileSpreadsheet, GraduationCap, Lock, MessageSquareText, Target } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ContextoFormulario, IndicadorGestion, Medicion } from "@/lib/indicadores-gestion";
import { UMBRAL_VERDE } from "@/lib/semaforo-indicadores";
import { CATALOGO, ROMANO, VEREDICTO, formatearValor, rangosSemaforo, type CodigoIndicador } from "@/components/indicadores/catalogo";
import { AnilloSemaforo, SenalSemaforo, Sparkline } from "@/components/indicadores/graficos-svg";
import { GraficoTendencia } from "@/components/indicadores/grafico-tendencia";
import { FormAnalisis } from "@/components/indicadores/form-analisis";
import { FormPlanMejora, type PrecargaMejora } from "@/components/indicadores/form-plan-mejora";
import { ListaPlanesMejora } from "@/components/indicadores/planes-mejora";
import { PanelLateral } from "@/components/indicadores/panel-lateral";
import { CapacitacionesMedidas } from "@/components/indicadores/capacitaciones-medidas";
import { cn } from "@/lib/utils";

export type Escritura = {
  puede: boolean;
  /** Área sobre la que se escribe; null = institucional. */
  areaId: string | null;
  areaNombre: string | null;
  motivo: string | null;
};

const PERIODO: Record<Medicion["periodo"], string> = { cerrado: "Cerrado", "en-curso": "En curso", futuro: "Sin iniciar" };

/**
 * FICHA DE UN INDICADOR, con la organización de Almera (Seguimiento · Ficha
 * técnica · Análisis · Mediciones · Planes de mejora) sobre una cabecera KPI
 * de vidrio. La unidad de medida es la CAPACITACIÓN: la sección "Por
 * capacitación" manda en Seguimiento y en Mediciones, y el número del área o
 * institucional se presenta siempre como CONSOLIDADO de esas mediciones.
 * Todo lo numérico viene calculado por la plataforma; lo que se escribe
 * aquí es el análisis del responsable y la gestión de la mejora.
 */
export function FichaIndicador({
  datos,
  contexto,
  rutaBase,
  escritura,
  areaQuery,
}: {
  datos: IndicadorGestion;
  contexto: ContextoFormulario | null;
  rutaBase: string;
  escritura: Escritura;
  areaQuery: string | null;
}) {
  const f = CATALOGO[datos.codigo];
  const actual = datos.trimestres[datos.trimestreActual - 1];
  // Plan de mejora que nace de UNA capacitación (acción rápida de su fila).
  const [precarga, setPrecarga] = useState<PrecargaMejora | null>(null);
  const medidas = datos.capacitaciones.filter((c) => c.valor !== null).length;
  const preliminares = datos.capacitaciones.filter((c) => c.preliminar).length;
  const puedeMejora = escritura.puede && contexto !== null;
  const brecha = datos.anual.valor === null ? null : Math.round((datos.anual.valor - UMBRAL_VERDE) * 10) / 10;
  const analisisEscritura = datos.analisis.filter((a) => a.areaId === escritura.areaId);
  const sufijo = areaQuery ? `?area=${areaQuery}` : "";
  const alcanceTexto =
    datos.alcance.tipo === "institucional" ? "Institucional · todo el plan" : datos.alcance.tipo === "area" ? `Área · ${datos.alcance.areaNombre}` : `Mis áreas · ${datos.alcance.nombres.join(", ")}`;

  return (
    <div className="ind-ficha space-y-6" style={{ ["--ind-a" as string]: f.tono.a, ["--ind-b" as string]: f.tono.b }}>
      {/* Cabecera KPI */}
      <header className="ind-hero revelar" data-sem={datos.anual.sem}>
        <span className="ind-aurora" aria-hidden="true" />
        <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="ind-codigo">
                <f.Icono className="h-3 w-3" aria-hidden="true" />
                {datos.codigo}
                {f.principal && <em>Principal</em>}
              </span>
              <span className="ind-alcance">{alcanceTexto}</span>
              <span className="ind-alcance">Vigencia {datos.anio}</span>
            </div>
            <h1 className="ind-titulo-grande">{f.nombre}</h1>
            <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">{f.objetivo}</p>

            <div className="ind-kpis">
              <div>
                <span className="mono-label">Consolidado {datos.anio}</span>
                <b data-sem={datos.anual.sem}>{formatearValor(datos.codigo, datos.anual.valor)}</b>
                <small>
                  {VEREDICTO[datos.anual.sem]} · {medidas} de {datos.capacitaciones.length} capacitaciones medidas
                  {preliminares > 0 && ` (${preliminares} preliminar${preliminares === 1 ? "" : "es"})`}
                </small>
              </div>
              <div>
                <span className="mono-label">Trimestre {ROMANO[datos.trimestreActual - 1]} · vigente</span>
                <b data-sem={actual.sem}>{formatearValor(datos.codigo, actual.valor)}</b>
                <small>
                  {f.columnas[1]} {actual.variables[1]} · {f.columnas[0].toLowerCase()} {actual.variables[0]}
                </small>
              </div>
              <div>
                <span className="mono-label">Meta</span>
                <b>≥ {UMBRAL_VERDE} {f.unidad}</b>
                <small>{brecha === null ? "Sin línea base todavía" : brecha >= 0 ? `+${brecha} ${f.unidad} sobre la meta` : `${brecha} ${f.unidad} por debajo`}</small>
              </div>
              <div>
                <span className="mono-label">Planes de mejora</span>
                <b className={cn(datos.conteos.vencidos > 0 && "!text-destructive")}>{datos.conteos.abiertos + datos.conteos.enCurso + datos.conteos.vencidos}</b>
                <small>
                  {datos.conteos.vencidos > 0 ? `${datos.conteos.vencidos} vencido${datos.conteos.vencidos === 1 ? "" : "s"} · ` : ""}
                  {datos.conteos.cerrados} cerrado{datos.conteos.cerrados === 1 ? "" : "s"}
                </small>
              </div>
            </div>
          </div>

          <div className="ind-hero-lateral">
            <AnilloSemaforo valor={datos.anual.valor} sem={datos.anual.sem} texto={formatearValor(datos.codigo, datos.anual.valor)} tamano={150} grosor={12} etiqueta={`Consolidado · ${VEREDICTO[datos.anual.sem]}`} />
            <div className="ind-tira">
              {datos.trimestres.map((t) => (
                <span key={t.trimestre ?? 0} data-sem={t.sem} data-actual={t.trimestre === datos.trimestreActual || undefined} data-periodo={t.periodo} title={`${t.etiqueta} · ${PERIODO[t.periodo]}`}>
                  <i>T{ROMANO[(t.trimestre ?? 1) - 1]}</i>
                  <b>{formatearValor(datos.codigo, t.valor)}</b>
                </span>
              ))}
            </div>
          </div>
        </div>
      </header>

      <Tabs defaultValue="seguimiento">
        <TabsList className="plan-tabs">
          <TabsTrigger value="seguimiento">
            <Activity aria-hidden="true" />
            Seguimiento
          </TabsTrigger>
          <TabsTrigger value="ficha">
            <BookOpenText aria-hidden="true" />
            Ficha técnica
          </TabsTrigger>
          <TabsTrigger value="analisis">
            <MessageSquareText aria-hidden="true" />
            Análisis
            <span className="conteo">{datos.analisis.length}</span>
          </TabsTrigger>
          <TabsTrigger value="mediciones">
            <FileSpreadsheet aria-hidden="true" />
            Mediciones
          </TabsTrigger>
          <TabsTrigger value="mejora">
            <ClipboardList aria-hidden="true" />
            Planes de mejora
            <span className="conteo">{datos.planesMejora.length}</span>
          </TabsTrigger>
        </TabsList>

        {/* ── Seguimiento ── */}
        <TabsContent value="seguimiento" className="space-y-5 pt-5">
          <section className="ind-panel ind-panel-caps p-5">
            <Encabezado
              icono={<GraduationCap className="h-4 w-4" aria-hidden="true" />}
              titulo={`Por capacitación · ${alcanceTexto}`}
              detalle={`Cada capacitación del PIC se mide por separado: ${fuenteCorta(datos.codigo)}. Lo peor primero. ${medidas === 0 ? vacioTexto(datos.codigo) : "El consolidado de abajo es solo el agregado de estas filas."}`}
            />
            <CapacitacionesMedidas codigo={datos.codigo} capacitaciones={datos.capacitaciones} rutaBase={rutaBase} anio={datos.anio} modo="lista" puedeMejora={puedeMejora} alPlanMejora={setPrecarga} />
          </section>

          <section className="ind-panel p-5">
            <Encabezado titulo={`Consolidado por trimestre · ${datos.anio}`} detalle="Agregado de las capacitaciones programadas en cada trimestre. Cada punto toma el color de su semáforo; la banda verde es la zona de cumplimiento y la línea discontinua, la meta. Un trimestre sin dato deja hueco: no se interpola." />
            <div className="mt-4">
              <GraficoTendencia codigo={datos.codigo} trimestres={datos.trimestres} actual={datos.trimestreActual} anio={datos.anio} />
            </div>
          </section>

          {datos.porArea.length > 1 && (
            <section className="ind-panel p-5">
              <Encabezado titulo="Consolidado por área" detalle="El agregado de las capacitaciones de cada área, con cuántas ya tienen dato. Toca una para abrir su ficha y ver sus capacitaciones." />
              <ul className="ind-areas">
                {datos.porArea.map((a) => (
                  <li key={a.areaId}>
                    <Link href={`${rutaBase}/indicadores/${datos.codigo}?area=${a.areaId}`} className="ind-area" data-sem={a.anual.sem} data-activa={areaQuery === a.areaId || undefined}>
                      <div className="min-w-0 flex-1">
                        <b className="block truncate">{a.areaNombre}</b>
                        <small>
                          {a.medidas} de {a.programadas} capacitaciones medidas · {f.columnas[1].toLowerCase()} {a.anual.variables[1]}
                          {a.planesAbiertos > 0 && ` · ${a.planesAbiertos} plan${a.planesAbiertos === 1 ? "" : "es"} de mejora`}
                        </small>
                      </div>
                      <Sparkline valores={a.trimestres.map((t) => t.valor)} sems={a.trimestres.map((t) => t.sem)} actual={datos.trimestreActual} ancho={96} alto={30} />
                      <span className="ind-area-valor" data-sem={a.anual.sem}>
                        {formatearValor(datos.codigo, a.anual.valor)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </TabsContent>

        {/* ── Ficha técnica ── */}
        <TabsContent value="ficha" className="pt-5">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
            <section className="ind-panel p-5">
              <Encabezado titulo="Identidad del indicador" />
              <dl className="ind-spec">
                <div>
                  <dt>Código</dt>
                  <dd className="font-mono">{datos.codigo}</dd>
                </div>
                <div>
                  <dt>Nombre</dt>
                  <dd>{f.nombre}</dd>
                </div>
                <div>
                  <dt>Tipo</dt>
                  <dd>{f.principal ? "Indicador principal de resultado" : "Indicador de gestión"}</dd>
                </div>
                <div>
                  <dt>Objetivo</dt>
                  <dd>{f.objetivo}</dd>
                </div>
                <div>
                  <dt>Unidad de medida</dt>
                  <dd>{f.unidad === "pp" ? "Puntos porcentuales (pp)" : "Porcentaje (%)"}</dd>
                </div>
                <div>
                  <dt>Periodicidad</dt>
                  <dd>{f.periodicidad}</dd>
                </div>
                <div>
                  <dt>Fuente de datos</dt>
                  <dd>{f.fuente}</dd>
                </div>
                <div>
                  <dt>Responsable</dt>
                  <dd>{f.responsable}</dd>
                </div>
                <div>
                  <dt>Alcance</dt>
                  <dd>{f.alcance}</dd>
                </div>
                <div>
                  <dt>Tendencia deseada</dt>
                  <dd>Ascendente: a mayor valor, mejor.</dd>
                </div>
              </dl>
            </section>

            <div className="grid content-start gap-5">
              <section className="ind-panel p-5">
                <Encabezado titulo="Fórmula" />
                <p className="ind-formula">{f.formula}</p>
                <table className="ind-variables">
                  <thead>
                    <tr>
                      <th scope="col">Var.</th>
                      <th scope="col">Nombre</th>
                      <th scope="col">Qué cuenta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {f.variables.map((v) => (
                      <tr key={v.simbolo}>
                        <td className="font-mono font-semibold">{v.simbolo}</td>
                        <td className="font-semibold">{v.nombre}</td>
                        <td>{v.descripcion}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              <section className="ind-panel p-5">
                <Encabezado titulo="Meta y semaforización" detalle={f.meta} />
                <ul className="ind-rangos">
                  {rangosSemaforo(f.unidad).map((r) => (
                    <li key={r.sem} data-sem={r.sem} data-activo={datos.anual.sem === r.sem || undefined}>
                      <i aria-hidden="true" />
                      <b>{r.etiqueta}</b>
                      <span className="font-mono">{r.rango}</span>
                      {datos.anual.sem === r.sem && <Target className="ml-auto h-3.5 w-3.5" aria-hidden="true" />}
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </div>
        </TabsContent>

        {/* ── Análisis ── */}
        <TabsContent value="analisis" className="space-y-5 pt-5">
          {escritura.puede ? (
            <section className="ind-panel p-5">
              <Encabezado titulo={`Redactar análisis · ${escritura.areaNombre ? `área ${escritura.areaNombre}` : "institucional"}`} detalle="Lo escribe el responsable, por periodo. El número lo pone la plataforma; aquí va el porqué y el qué sigue." />
              <div className="mt-4">
                <FormAnalisis planId={datos.planId} codigo={datos.codigo} anio={datos.anio} areaId={escritura.areaId} trimestres={datos.trimestres} existentes={analisisEscritura} trimestreInicial={datos.trimestreActual} />
              </div>
            </section>
          ) : (
            escritura.motivo && (
              <p className="ind-aviso">
                <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                {escritura.motivo}
              </p>
            )
          )}

          <section className="grid gap-3">
            {datos.trimestres.map((t) => {
              const suyos = datos.analisis.filter((a) => a.trimestre === t.trimestre);
              return (
                <article key={t.trimestre ?? 0} className="ind-analisis" data-sem={t.sem} data-periodo={t.periodo}>
                  <div className="ind-analisis-medida">
                    <span className="mono-label">{t.etiqueta}</span>
                    <b>{formatearValor(datos.codigo, t.valor)}</b>
                    <SenalSemaforo sem={t.sem}>{VEREDICTO[t.sem]}</SenalSemaforo>
                    <small>
                      {f.columnas[0]}: {t.variables[0]}
                      <br />
                      {f.columnas[1]}: {t.variables[1]}
                    </small>
                    <small className="opacity-70">{PERIODO[t.periodo]}</small>
                  </div>
                  <div className="min-w-0 flex-1">
                    {suyos.length === 0 ? (
                      <p className="text-[13px] text-muted-foreground">{t.periodo === "futuro" ? "El periodo no ha iniciado." : "Sin análisis registrado para este periodo."}</p>
                    ) : (
                      <div className="grid gap-3">
                        {suyos.map((a) => (
                          <div key={a.id}>
                            {datos.alcance.tipo !== "area" && (
                              <span className="ind-alcance mb-1.5 inline-flex">{a.areaNombre ?? "Institucional"}</span>
                            )}
                            <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-foreground/90">{a.texto}</p>
                            <p className="mt-1.5 text-[11.5px] text-muted-foreground">
                              {a.autor ?? "—"} · {a.actualizado}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
        </TabsContent>

        {/* ── Mediciones ── */}
        <TabsContent value="mediciones" className="space-y-5 pt-5">
          <section className="ind-panel ind-panel-caps overflow-hidden">
            <div className="p-5 pb-0">
              <Encabezado
                icono={<GraduationCap className="h-4 w-4" aria-hidden="true" />}
                titulo={`Mediciones por capacitación · ${alcanceTexto}`}
                detalle={`La unidad del indicador. ${f.formula} ${medidas === 0 ? vacioTexto(datos.codigo) : ""}`}
              />
            </div>
            <div className="px-5 pb-5">
              <CapacitacionesMedidas codigo={datos.codigo} capacitaciones={datos.capacitaciones} rutaBase={rutaBase} anio={datos.anio} modo="tabla" puedeMejora={puedeMejora} alPlanMejora={setPrecarga} />
            </div>
          </section>

          <section className="ind-panel overflow-hidden">
            <div className="p-5 pb-3">
              <Encabezado titulo={`Consolidado por periodo · ${alcanceTexto}`} detalle="Agregado de las mediciones por capacitación de cada corte; generado por la plataforma en tiempo real, nadie registra el valor a mano. El consolidado del año es la misma fórmula sobre todas las capacitaciones." />
            </div>
            <div className="overflow-x-auto">
              <table className="ind-tabla">
                <thead>
                  <tr>
                    <th scope="col">Periodo</th>
                    <th scope="col" className="text-right">Valor</th>
                    <th scope="col" className="text-right">{f.columnas[0]}</th>
                    <th scope="col" className="text-right">{f.columnas[1]}</th>
                    <th scope="col">Semáforo</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Fuente</th>
                    <th scope="col">Generado por</th>
                  </tr>
                </thead>
                <tbody>
                  {[...datos.trimestres, datos.anual].map((m) => (
                    <tr key={m.trimestre ?? "anual"} data-acumulado={m.trimestre === null || undefined}>
                      <td className="font-semibold">{m.etiqueta}</td>
                      <td className="text-right">
                        <b className="ind-valor" data-sem={m.sem}>
                          {formatearValor(datos.codigo, m.valor)}
                        </b>
                      </td>
                      <td className="text-right font-mono">{m.variables[0]}</td>
                      <td className="text-right font-mono">{m.variables[1]}</td>
                      <td>
                        <SenalSemaforo sem={m.sem}>{VEREDICTO[m.sem]}</SenalSemaforo>
                      </td>
                      <td className="text-muted-foreground">{m.trimestre === null ? "Consolidado" : PERIODO[m.periodo]}</td>
                      <td className="max-w-[260px] whitespace-normal text-[12px] text-muted-foreground">{fuenteCorta(datos.codigo)}</td>
                      <td className="text-[12px] text-muted-foreground">{m.generado}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {datos.porArea.length > 1 && (
            <section className="ind-panel overflow-hidden">
              <div className="p-5 pb-3">
                <Encabezado titulo="Consolidado por área y trimestre" detalle={`Agregado de las capacitaciones de cada área en cada corte. Entre paréntesis, ${f.columnas[1].toLowerCase()} / ${f.columnas[0].toLowerCase()}; a la derecha, capacitaciones con dato / programadas.`} />
              </div>
              <div className="overflow-x-auto">
                <table className="ind-tabla">
                  <thead>
                    <tr>
                      <th scope="col">Área / proceso</th>
                      {ROMANO.map((r) => (
                        <th key={r} scope="col" className="text-right">
                          T{r}
                        </th>
                      ))}
                      <th scope="col" className="text-right">Consolidado</th>
                      <th scope="col" className="text-right">Medidas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.porArea.map((a) => (
                      <tr key={a.areaId}>
                        <td className="font-semibold">
                          <Link href={`${rutaBase}/indicadores/${datos.codigo}?area=${a.areaId}`} className="ind-area-enlace">
                            {a.areaNombre}
                          </Link>
                        </td>
                        {a.trimestres.map((t) => (
                          <td key={t.trimestre ?? 0} className="text-right">
                            <CeldaValor codigo={datos.codigo} m={t} />
                          </td>
                        ))}
                        <td className="text-right">
                          <CeldaValor codigo={datos.codigo} m={a.anual} />
                        </td>
                        <td className="text-right font-mono text-[12px] text-muted-foreground">
                          {a.medidas}/{a.programadas}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </TabsContent>

        {/* ── Planes de mejora ── */}
        <TabsContent value="mejora" className="space-y-5 pt-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Encabezado titulo="Planes de mejora" detalle="Cada plan nace de una medición y se asigna a la vigencia, el trimestre, el área y -si aplica- la capacitación del PIC. Con responsable, fecha de compromiso y bitácora de seguimientos." />
              <ul className="ind-conteos mt-3" aria-label="Planes por estado">
                <li data-estado="ABIERTO">
                  <b>{datos.conteos.abiertos}</b> abiertos
                </li>
                <li data-estado="EN_CURSO">
                  <b>{datos.conteos.enCurso}</b> en curso
                </li>
                <li data-estado="VENCIDO">
                  <b>{datos.conteos.vencidos}</b> vencidos
                </li>
                <li data-estado="CERRADO">
                  <b>{datos.conteos.cerrados}</b> cerrados
                </li>
              </ul>
            </div>
            {escritura.puede && contexto ? (
              <PanelLateral etiqueta="Nuevo plan de mejora" titulo={`Plan de mejora · ${f.corto}`} descripcion="Asígnalo a la vigencia, el área y la capacitación a la que responde.">
                {(cerrar) => (
                  <FormPlanMejora
                    planId={datos.planId}
                    codigo={datos.codigo}
                    contexto={contexto}
                    trimestres={datos.trimestres}
                    trimestreInicial={datos.trimestreActual}
                    areaFija={escritura.areaId ? { id: escritura.areaId, nombre: escritura.areaNombre ?? "Área" } : null}
                    alCrear={cerrar}
                  />
                )}
              </PanelLateral>
            ) : (
              escritura.motivo && (
                <p className="ind-aviso">
                  <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                  {escritura.motivo}
                </p>
              )
            )}
          </div>
          <ListaPlanesMejora planes={datos.planesMejora} puedeEscribir={escritura.puede} />
        </TabsContent>
      </Tabs>

      {/* Plan de mejora desde UNA capacitación: el panel ya viene con el área, la capacitación y el hallazgo. */}
      {puedeMejora && contexto && (
        <PanelLateral abierto={precarga !== null} alCambiar={(v) => !v && setPrecarga(null)} titulo={`Plan de mejora · ${f.corto}`} descripcion={precarga ? `Nace de la capacitación «${precarga.activityTitulo}».` : undefined}>
          {(cerrar) =>
            precarga && (
              <FormPlanMejora
                key={precarga.activityId}
                planId={datos.planId}
                codigo={datos.codigo}
                contexto={contexto}
                trimestres={datos.trimestres}
                trimestreInicial={datos.trimestreActual}
                areaFija={escritura.areaId ? { id: escritura.areaId, nombre: escritura.areaNombre ?? "Área" } : null}
                precarga={precarga}
                alCrear={cerrar}
              />
            )
          }
        </PanelLateral>
      )}

      {/* Pie: navegación entre los tres indicadores sin volver atrás. */}
      <nav className="ind-saltos" aria-label="Otros indicadores">
        {(Object.keys(CATALOGO) as CodigoIndicador[]).map((c) => (
          <Link key={c} href={`${rutaBase}/indicadores/${c}${sufijo}`} data-actual={c === datos.codigo || undefined}>
            <span className="font-mono">{c}</span>
            {CATALOGO[c].corto}
          </Link>
        ))}
      </nav>
    </div>
  );
}

function Encabezado({ titulo, detalle, icono }: { titulo: string; detalle?: string; icono?: ReactNode }) {
  return (
    <div>
      <h2 className="flex items-center gap-1.5 font-display text-[1rem] font-bold tracking-tight text-foreground">
        {icono}
        {titulo}
      </h2>
      {detalle && <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">{detalle}</p>}
    </div>
  );
}

function CeldaValor({ codigo, m }: { codigo: CodigoIndicador; m: Medicion }) {
  return (
    <span className="ind-valor-celda" data-sem={m.sem} data-periodo={m.periodo}>
      <b>{formatearValor(codigo, m.valor)}</b>
      <small>
        ({m.variables[1]}/{m.variables[0]})
      </small>
    </span>
  );
}

function fuenteCorta(codigo: CodigoIndicador) {
  switch (codigo) {
    case "PIC-ADH-01":
      return "mejora pre → post de quienes completaron el ciclo en esa jornada (preliminar mientras siga abierta; definitiva al cerrarla, desde el acta)";
    case "PIC-COB-02":
      return "tiene evaluación presaber / postsaber configurada o no";
    case "PIC-ASI-03":
      return "personas con asistencia registrada sobre la audiencia objetivo de esa capacitación";
  }
}

/** Qué hace falta para que aparezca el primer dato, cuando ninguna capacitación lo tiene todavía. */
function vacioTexto(codigo: CodigoIndicador) {
  switch (codigo) {
    case "PIC-ADH-01":
      return "Todavía sin dato: la adherencia aparece en cuanto alguien completa presaber y postsaber en una capacitación, con la jornada abierta (preliminar) o cerrada (definitivo).";
    case "PIC-COB-02":
      return "Todavía no hay capacitaciones programadas en este alcance.";
    case "PIC-ASI-03":
      return "Todavía sin dato: aparece con la primera asistencia registrada sobre una audiencia objetivo definida.";
  }
}
