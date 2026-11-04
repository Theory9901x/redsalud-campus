import { redirect } from "next/navigation";
import { Trophy, UserRound, Vote } from "lucide-react";
import type { GalardonValor } from "@prisma/client";
import { requireSession } from "@/lib/auth-helpers";
import { esSoloLectura, veComoAdmin } from "@/lib/roles";
import { parsePageSize } from "@/lib/pagination";
import { IPS_GALARDONES } from "@/lib/galardones/ips";
import { ORDEN_VALORES, valorInfo } from "@/lib/galardones/valores";
import { estadoConvocatoria, listadoCandidatos, postulacionesPaginadas, resultadosGalardones } from "@/lib/galardones/consultas";
import { eliminarCandidato, eliminarPostulacion } from "@/app/galardones/acciones";
import { CabeceraGalardonesAdmin, PestanasGalardones } from "@/components/galardones/admin/cabecera-admin";
import { ResultadosGalardonesAdmin } from "@/components/galardones/admin/resultados-admin";
import { FormularioConvocatoria, NombreCandidatoEditable } from "@/components/galardones/admin/tablas-admin";
import { AutoFilterSelect, AutoSearchInput } from "@/components/admin/auto-search-input";
import { TablePagination } from "@/components/admin/table-pagination";
import { DeleteEntityButton } from "@/components/admin/delete-entity-button";
import { EmptyState } from "@/components/brand/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { nombrePropio } from "@/lib/nombre-propio";

const FECHA_HORA = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" });
const VISTAS = ["resultados", "postulaciones", "candidatos", "convocatoria"] as const;
type Vista = (typeof VISTAS)[number];

/**
 * GESTIÓN DE GALARDONES en el panel admin: resultados por centro y valor,
 * la base de datos de postulaciones fila a fila (buscar, filtrar, borrar),
 * las personas postuladas (renombrar, borrar sobrantes) y la convocatoria.
 * La postulación en sí sigue en /galardones, con su propio entorno.
 */
export default async function GalardonesAdminPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sesion = await requireSession("/admin/galardones");
  if (!veComoAdmin(sesion.user.role)) redirect("/no-autorizado");
  if (sesion.user.role === "ADMIN" && (sesion.user.restrictedAdminSections ?? []).includes("USUARIOS")) redirect("/no-autorizado");
  const soloLectura = esSoloLectura(sesion.user.role);

  const sp = await searchParams;
  const vista: Vista = (VISTAS as readonly string[]).includes(sp.vista ?? "") ? (sp.vista as Vista) : "resultados";
  const ipsFiltro = (IPS_GALARDONES as readonly string[]).includes(sp.ips ?? "") ? sp.ips : undefined;
  const valorFiltro = (ORDEN_VALORES as readonly string[]).includes(sp.valor ?? "") ? (sp.valor as GalardonValor) : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const pageSize = parsePageSize(sp.pageSize);

  const [convocatoria, resultados] = await Promise.all([estadoConvocatoria(), resultadosGalardones()]);

  return (
    <div className="space-y-6">
      <CabeceraGalardonesAdmin convocatoria={convocatoria} resultados={resultados} />
      <PestanasGalardones activa={vista} />

      {vista === "resultados" && <ResultadosGalardonesAdmin resultados={resultados} soloLectura={soloLectura} />}

      {vista === "postulaciones" && (
        <Postulaciones q={sp.q} ips={ipsFiltro} valor={valorFiltro} page={page} pageSize={pageSize} soloLectura={soloLectura} />
      )}

      {vista === "candidatos" && <Candidatos q={sp.q} ips={ipsFiltro} soloLectura={soloLectura} />}

      {vista === "convocatoria" && (
        <FormularioConvocatoria
          inicial={{ abierta: convocatoria.abierta, cierraEl: convocatoria.cierraEl ? convocatoria.cierraEl.toISOString() : null, anio: convocatoria.anio }}
          soloLectura={soloLectura}
        />
      )}
    </div>
  );
}

const OPCIONES_IPS = IPS_GALARDONES.map((i) => ({ value: i, label: i }));
const OPCIONES_VALOR = ORDEN_VALORES.map((v) => ({ value: v, label: valorInfo(v).nombre }));

async function Postulaciones({ q, ips, valor, page, pageSize, soloLectura }: { q?: string; ips?: string; valor?: GalardonValor; page: number; pageSize: number; soloLectura: boolean }) {
  const { total, filas } = await postulacionesPaginadas({ q, ips, valor, page, pageSize });
  return (
    <section className="surface-panel overflow-hidden" aria-label="Postulaciones">
      <div className="flex flex-wrap items-end gap-3 border-b border-border/70 p-4">
        <div className="min-w-[16rem] flex-1">
          <AutoSearchInput placeholder="Buscar por quien postula, persona postulada, documento o motivo…" label="Buscar" />
        </div>
        <AutoFilterSelect paramName="ips" label="Centro IPS" options={OPCIONES_IPS} allLabel="Todos los centros" />
        <AutoFilterSelect paramName="valor" label="Valor" options={OPCIONES_VALOR} allLabel="Los tres valores" />
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
