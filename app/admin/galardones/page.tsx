import { redirect } from "next/navigation";
import { Activity, Trophy, UserRound, Vote } from "lucide-react";
import type { GalardonEstado, GalardonValor } from "@prisma/client";
import { requireSession } from "@/lib/auth-helpers";
import { esSoloLectura, veComoAdmin } from "@/lib/roles";
import { parsePageSize } from "@/lib/pagination";
import { IPS_GALARDONES } from "@/lib/galardones/ips";
import { ORDEN_VALORES, valorInfo } from "@/lib/galardones/valores";
import {
  actividadGalardones,
  estadoConvocatoria,
  ganadoresGalardones,
  listadoCandidatos,
  postulacionesPaginadas,
  resultadosGalardones,
  resumenActividadGalardones,
  type TipoActividad,
} from "@/lib/galardones/consultas";
import { eliminarCandidato, eliminarPostulacion } from "@/app/galardones/acciones";
import { CabeceraGalardonesAdmin, PestanasGalardones } from "@/components/galardones/admin/cabecera-admin";
import { ResultadosGalardonesAdmin } from "@/components/galardones/admin/resultados-admin";
import { GanadoresAdmin } from "@/components/galardones/admin/ganadores-admin";
import { RefrescoEnVivo } from "@/components/galardones/admin/refresco-en-vivo";
import { FormularioConvocatoria, NombreCandidatoEditable } from "@/components/galardones/admin/tablas-admin";
import { AutoFilterSelect, AutoSearchInput } from "@/components/admin/auto-search-input";
import { TablePagination } from "@/components/admin/table-pagination";
import { DeleteEntityButton } from "@/components/admin/delete-entity-button";
import { EmptyState } from "@/components/brand/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { nombrePropio } from "@/lib/nombre-propio";

const FECHA_HORA = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" });
const VISTAS = ["resultados", "ganadores", "postulaciones", "candidatos", "actividad", "convocatoria"] as const;
const FECHA_HORA_SEG = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "medium", timeZone: "America/Bogota" });
const DIA_LARGO = new Intl.DateTimeFormat("es-CO", { weekday: "short", day: "numeric", month: "short", timeZone: "America/Bogota" });
const TIPOS_ACTIVIDAD: { value: TipoActividad; label: string }[] = [
  { value: "votaciones", label: "Votaciones recibidas" },
  { value: "gestion", label: "Cambios de la gestión" },
];
const ETIQUETA_ACCION: Record<string, { texto: string; clase: string }> = {
  CREATE: { texto: "Votó", clase: "border-success/30 bg-success/10 text-success" },
  DELETE: { texto: "Eliminación", clase: "border-destructive/30 bg-destructive/10 text-destructive" },
  UPDATE: { texto: "Cambio", clase: "border-primary/30 bg-primary/10 text-primary" },
};
const ESTADOS: { value: GalardonEstado; label: string }[] = [
  { value: "VALIDA", label: "Válidas" },
  { value: "ANULADA", label: "Anuladas" },
];
const ETIQUETA_ESTADO: Record<GalardonEstado, { texto: string; clase: string }> = {
  VALIDA: { texto: "Válida", clase: "border-success/30 bg-success/10 text-success" },
  POR_VERIFICAR: { texto: "Por verificar", clase: "border-warning/40 bg-warning/15 text-warning-foreground" },
  ANULADA: { texto: "Anulada", clase: "border-destructive/30 bg-destructive/10 text-destructive" },
};
type Vista = (typeof VISTAS)[number];

/**
 * GESTIÓN DE GALARDONES en el panel admin: resultados por centro y valor,
 * la base de datos de postulaciones fila a fila (buscar, filtrar, borrar),
 * las personas postuladas (renombrar, borrar sobrantes), el registro de
 * actividad (cada votación que entra, con su hora) y la convocatoria.
 * La postulación en sí sigue en /galardones, con su propio entorno.
 */
export default async function GalardonesAdminPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sesion = await requireSession("/admin/galardones");
  if (!veComoAdmin(sesion.user.role)) redirect("/no-autorizado");
  if ((sesion.user.restrictedAdminSections ?? []).includes("USUARIOS")) redirect("/no-autorizado");
  const soloLectura = esSoloLectura(sesion.user.role);

  const sp = await searchParams;
  const vista: Vista = (VISTAS as readonly string[]).includes(sp.vista ?? "") ? (sp.vista as Vista) : "resultados";
  const ipsFiltro = (IPS_GALARDONES as readonly string[]).includes(sp.ips ?? "") ? sp.ips : undefined;
  const valorFiltro = (ORDEN_VALORES as readonly string[]).includes(sp.valor ?? "") ? (sp.valor as GalardonValor) : undefined;
  const estadoFiltro = ESTADOS.some((e) => e.value === sp.estado) ? (sp.estado as GalardonEstado) : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const pageSize = parsePageSize(sp.pageSize);

  const [convocatoria, resultados, ganadores] = await Promise.all([estadoConvocatoria(), resultadosGalardones(), ganadoresGalardones()]);
  const porDefinir = ganadores.reduce((n, c) => n + c.ganadores.filter((g) => g.origen === "EMPATE" || (g.origen === "SIN_POSTULACIONES" && !!g.nota)).length, 0);

  return (
    <div className="space-y-6">
      <CabeceraGalardonesAdmin convocatoria={convocatoria} resultados={resultados} porDefinir={porDefinir} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PestanasGalardones activa={vista} porDefinir={porDefinir} />
        {/* La convocatoria es un formulario: no se refresca bajo los dedos de quien lo edita. */}
        {vista !== "convocatoria" && <RefrescoEnVivo />}
      </div>

      {vista === "resultados" && <ResultadosGalardonesAdmin resultados={resultados} soloLectura={soloLectura} />}

      {vista === "ganadores" && <GanadoresAdmin centros={ganadores} resultados={resultados} soloLectura={soloLectura} />}

      {vista === "postulaciones" && (
        <Postulaciones q={sp.q} ips={ipsFiltro} valor={valorFiltro} estado={estadoFiltro} page={page} pageSize={pageSize} soloLectura={soloLectura} />
      )}

      {vista === "candidatos" && <Candidatos q={sp.q} ips={ipsFiltro} soloLectura={soloLectura} />}

      {vista === "actividad" && (
        <Actividad q={sp.q} tipo={TIPOS_ACTIVIDAD.some((t) => t.value === sp.tipo) ? (sp.tipo as TipoActividad) : undefined} page={page} pageSize={pageSize} />
      )}

      {vista === "convocatoria" && (
        <FormularioConvocatoria
          inicial={{
            abierta: convocatoria.abierta,
            cierraEl: convocatoria.cierraEl ? convocatoria.cierraEl.toISOString() : null,
            anio: convocatoria.anio,
          }}
          soloLectura={soloLectura}
        />
      )}
    </div>
  );
}

const OPCIONES_IPS = IPS_GALARDONES.map((i) => ({ value: i, label: i }));
const OPCIONES_VALOR = ORDEN_VALORES.map((v) => ({ value: v, label: valorInfo(v).nombre }));

async function Postulaciones({ q, ips, valor, estado, page, pageSize, soloLectura }: { q?: string; ips?: string; valor?: GalardonValor; estado?: GalardonEstado; page: number; pageSize: number; soloLectura: boolean }) {
  const { total, filas } = await postulacionesPaginadas({ q, ips, valor, estado, page, pageSize });
  return (
    <section className="surface-panel overflow-hidden" aria-label="Postulaciones">
      <div className="flex flex-wrap items-end gap-3 border-b border-border/70 p-4">
        <div className="min-w-[16rem] flex-1">
          <AutoSearchInput placeholder="Buscar por quien postula, persona postulada, documento o motivo…" label="Buscar" />
        </div>
        <AutoFilterSelect paramName="ips" label="Centro IPS" options={OPCIONES_IPS} allLabel="Todos los centros" />
        <AutoFilterSelect paramName="valor" label="Valor" options={OPCIONES_VALOR} allLabel="Los tres valores" />
        <AutoFilterSelect paramName="estado" label="Estado" options={ESTADOS} allLabel="Todos los estados" />
        <p className="ml-auto text-[12.5px] text-muted-foreground">
          {total} {total === 1 ? "postulación" : "postulaciones"}
        </p>
      </div>

      {filas.length === 0 ? (
        <EmptyState icon={Vote} title="Sin postulaciones" description={q || ips || valor ? "Ninguna coincide con el filtro." : "Todavía nadie ha postulado."} className="py-14" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Quien postula</TableHead>
              <TableHead>Centro IPS</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Persona postulada</TableHead>
              <TableHead className="min-w-[18rem]">Comportamiento descrito</TableHead>
              <TableHead>Estado</TableHead>
              {!soloLectura && <TableHead className="w-12" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.map((p) => {
              const info = valorInfo(p.valor);
              const escrito = p.nombreEscrito.trim();
              return (
                <TableRow key={p.id}>
                  <TableCell className="whitespace-nowrap text-[12px] text-muted-foreground">{FECHA_HORA.format(p.createdAt)}</TableCell>
                  <TableCell>
                    <p className="font-semibold text-foreground">{nombrePropio(p.votante.fullName)}</p>
                    <p className="text-[11.5px] text-muted-foreground">
                      {p.votante.documentNumber}
                      {p.votante.position ? ` · ${p.votante.position}` : ""}
                    </p>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{p.ips}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12.5px] font-semibold">
                      <span className="h-2 w-2 rounded-full" style={{ background: `oklch(0.62 0.13 ${info.matiz})` }} aria-hidden="true" />
                      {info.nombre}
                    </span>
                  </TableCell>
                  <TableCell>
                    <p className="font-semibold text-foreground">
                      {p.candidato.nombre}
                      {p.candidato.userId && <span className="ml-1.5 rounded-full border border-primary/30 bg-primary/10 px-1.5 text-[9.5px] font-bold uppercase tracking-wider text-primary">campus</span>}
                    </p>
                    {escrito && escrito.localeCompare(p.candidato.nombre, "es", { sensitivity: "base" }) !== 0 && (
                      <p className="text-[11.5px] text-muted-foreground">Escrito como «{escrito}»</p>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[28rem] text-[12.5px] leading-relaxed text-muted-foreground">{p.motivo}</TableCell>
                  <TableCell>
                    <span className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-bold ${ETIQUETA_ESTADO[p.estado].clase}`}>
                      {ETIQUETA_ESTADO[p.estado].texto}
                    </span>
                  </TableCell>
                  {!soloLectura && (
                    <TableCell>
                      <DeleteEntityButton
                        action={eliminarPostulacion.bind(null, p.id)}
                        nombre="La postulación"
                        titulo="¿Eliminar esta postulación?"
                        descripcion={`Se borra la postulación de ${nombrePropio(p.votante.fullName)} a «${p.candidato.nombre}» por ${info.nombre}. Quien postuló podrá volver a diligenciar ese valor. No se puede deshacer.`}
                      />
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
      <TablePagination total={total} page={page} pageSize={pageSize} />
    </section>
  );
}

async function Candidatos({ q, ips, soloLectura }: { q?: string; ips?: string; soloLectura: boolean }) {
  const candidatos = await listadoCandidatos({ q, ips });
  return (
    <section className="surface-panel overflow-hidden" aria-label="Personas postuladas">
      <div className="flex flex-wrap items-end gap-3 border-b border-border/70 p-4">
        <div className="min-w-[16rem] flex-1">
          <AutoSearchInput placeholder="Buscar persona postulada…" label="Buscar" />
        </div>
        <AutoFilterSelect paramName="ips" label="Centro IPS" options={OPCIONES_IPS} allLabel="Todos los centros" />
        <p className="ml-auto text-[12.5px] text-muted-foreground">
          {candidatos.length} {candidatos.length === 1 ? "persona" : "personas"}
        </p>
      </div>
      <p className="border-b border-border/70 bg-muted/40 px-4 py-2.5 text-[12px] text-muted-foreground">
        Cada persona postulada es un registro al que se suman las postulaciones aunque su nombre se haya escrito distinto. Aquí se corrige el nombre
        con el que se muestra y se eliminan los registros que quedaron sin postulaciones tras fusionar o separar. Para fusionar o separar, usa la
        pestaña Resultados.
      </p>

      {candidatos.length === 0 ? (
        <EmptyState icon={UserRound} title="Sin personas postuladas" description={q || ips ? "Ninguna coincide con el filtro." : "Aparecerán con la primera postulación."} className="py-14" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Persona</TableHead>
              <TableHead>Centro IPS</TableHead>
              <TableHead>Cuenta del campus</TableHead>
              <TableHead className="text-right">Postulaciones</TableHead>
              <TableHead>Estado</TableHead>
              {!soloLectura && <TableHead className="w-12" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {candidatos.map((c) => (
              <TableRow key={c.id} className={c.fusionadoEnId ? "opacity-60" : undefined}>
                <TableCell>
                  <NombreCandidatoEditable id={c.id} nombre={c.nombre} soloLectura={soloLectura} />
                </TableCell>
                <TableCell className="whitespace-nowrap">{c.ips}</TableCell>
                <TableCell className="text-[12.5px] text-muted-foreground">
                  {c.user ? (
                    <>
                      {nombrePropio(c.user.fullName)}
                      {c.user.position ? ` · ${c.user.position}` : ""}
                    </>
                  ) : (
                    <span className="opacity-70">Nombre libre</span>
                  )}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{c._count.postulaciones}</TableCell>
                <TableCell className="text-[12px] text-muted-foreground">
                  {c.fusionadoEn ? (
                    <span>Fusionado en «{c.fusionadoEn.nombre}»</span>
                  ) : c._count.fusionados > 0 ? (
                    <span>Reúne {c._count.fusionados} registro(s) fusionado(s)</span>
                  ) : c._count.postulaciones === 0 ? (
                    <span className="text-warning-foreground">Sin postulaciones</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-success">
                      <Trophy className="h-3 w-3" aria-hidden="true" />
                      En competencia
                    </span>
                  )}
                </TableCell>
                {!soloLectura && (
                  <TableCell>
                    {c._count.postulaciones === 0 && (
                      <DeleteEntityButton
                        action={eliminarCandidato.bind(null, c.id)}
                        nombre={`«${c.nombre}»`}
                        descripcion={`Se borra el registro de «${c.nombre}» (${c.ips}). No tiene postulaciones, así que los resultados no cambian.`}
                      />
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}

/**
 * REGISTRO DE ACTIVIDAD: cada votación que entra, con la hora exacta y a
 * quién postuló, y cada cambio hecho desde la gestión. Responde a «¿están
 * votando?» sin depender de que cambie quién va ganando: una votación puede
 * entrar y dejar a los mismos punteros.
 */
async function Actividad({ q, tipo, page, pageSize }: { q?: string; tipo?: TipoActividad; page: number; pageSize: number }) {
  const [{ total, filas }, resumen] = await Promise.all([actividadGalardones({ q, tipo, page, pageSize }), resumenActividadGalardones()]);
  const maximo = Math.max(1, ...resumen.porDia.map((d) => d.votaciones));
  return (
    <div className="space-y-4">
      <section className="surface-panel grid gap-5 p-5 lg:grid-cols-[minmax(0,18rem)_1fr]" aria-label="Resumen de actividad">
        <div className="space-y-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Personas que votaron hoy</p>
            <p className="font-display text-[2.4rem] font-extrabold leading-none tabular-nums text-foreground">{resumen.hoy}</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-background/70 px-3.5 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Última votación recibida</p>
            {resumen.ultima ? (
              <>
                <p className="mt-1 text-[14px] font-bold text-foreground">{FECHA_HORA_SEG.format(resumen.ultima.cuando)}</p>
                {resumen.ultima.quien && <p className="text-[12.5px] text-muted-foreground">{nombrePropio(resumen.ultima.quien)}</p>}
              </>
            ) : (
              <p className="mt-1 text-[13px] text-muted-foreground">Todavía no ha votado nadie.</p>
            )}
          </div>
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            {resumen.totalVotaciones} votaciones registradas en total. Cada votación son tres postulaciones (una por valor), y puede entrar sin que
            cambie quién va ganando.
          </p>
        </div>
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Votaciones por día</p>
          {resumen.porDia.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">Sin movimiento todavía.</p>
          ) : (
            <ol className="space-y-1.5">
              {resumen.porDia.map((d) => (
                <li key={d.dia} className="grid grid-cols-[7.5rem_1fr_auto] items-center gap-3 text-[12.5px]">
                  <span className="font-semibold capitalize text-foreground">{DIA_LARGO.format(new Date(`${d.dia}T12:00:00-05:00`))}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-foreground/[0.06]">
                    <i className="block h-full rounded-full bg-primary" style={{ width: `${Math.round((d.votaciones / maximo) * 100)}%` }} />
                  </span>
                  <span className="whitespace-nowrap tabular-nums text-muted-foreground">
                    <b className="text-foreground">{d.votaciones}</b> {d.votaciones === 1 ? "persona" : "personas"}
                    {d.gestion > 0 && ` · ${d.gestion} ${d.gestion === 1 ? "cambio" : "cambios"}`}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      <section className="surface-panel overflow-hidden" aria-label="Registro de actividad">
        <div className="flex flex-wrap items-end gap-3 border-b border-border/70 p-4">
          <div className="min-w-[16rem] flex-1">
            <AutoSearchInput placeholder="Buscar por persona, documento o detalle…" label="Buscar" />
          </div>
          <AutoFilterSelect paramName="tipo" label="Tipo" options={TIPOS_ACTIVIDAD} allLabel="Toda la actividad" />
          <p className="ml-auto text-[12.5px] text-muted-foreground">
            {total} {total === 1 ? "registro" : "registros"}
          </p>
        </div>

        {filas.length === 0 ? (
          <EmptyState icon={Activity} title="Sin actividad" description={q || tipo ? "Ningún registro coincide con el filtro." : "Aparecerá con la primera votación."} className="py-14" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha y hora</TableHead>
                <TableHead>Quién</TableHead>
                <TableHead>Qué pasó</TableHead>
                <TableHead className="min-w-[22rem]">Detalle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((a) => {
                const etiqueta = ETIQUETA_ACCION[a.accion] ?? ETIQUETA_ACCION.UPDATE;
                return (
                  <TableRow key={a.id}>
                    <TableCell className="whitespace-nowrap text-[12px] tabular-nums text-muted-foreground">{FECHA_HORA_SEG.format(a.cuando)}</TableCell>
                    <TableCell>
                      <p className="font-semibold text-foreground">{a.quien ? nombrePropio(a.quien.fullName) : "Cuenta eliminada"}</p>
                      {a.quien && (
                        <p className="text-[11.5px] text-muted-foreground">
                          {a.quien.documentNumber}
                          {a.quien.position ? ` · ${a.quien.position}` : ""}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-bold ${etiqueta.clase}`}>{etiqueta.texto}</span>
                    </TableCell>
                    <TableCell className="text-[12.5px] leading-relaxed text-muted-foreground">
                      <p>{a.descripcion}</p>
                      {a.esVoto &&
                        (a.vigente ? (
                          <p className="mt-0.5 text-foreground">
                            {a.votos.map((v, i) => (
                              <span key={v.valor}>
                                {i > 0 && " · "}
                                <span className="text-muted-foreground">{valorInfo(v.valor).nombre}:</span> {v.nombre}
                              </span>
                            ))}
                          </p>
                        ) : (
                          <p className="mt-0.5 text-warning-foreground">Esta votación se eliminó después (ya no suma).</p>
                        ))}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        <TablePagination total={total} page={page} pageSize={pageSize} />
      </section>
    </div>
  );
}
