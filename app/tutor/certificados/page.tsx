import Link from "next/link";
import type { CSSProperties } from "react";
import { Award, BadgeCheck, CheckCircle2, ExternalLink, Search } from "lucide-react";
import { requireTutorOrAdmin } from "@/lib/auth-helpers";
import { getAlcanceTutor, getConstanciasTutor } from "@/lib/tutor-inscritos";
import { ModuloHero } from "@/components/training-plans/modulo-hero";
import { escalon } from "@/components/training-plans/plan-visual";
import { etiquetaDiaMes } from "@/components/training-plans/labels";
import { PanelTutor, VacioCompacto } from "@/components/tutor/centro-mando";
import { Paginacion } from "@/components/tutor/paginacion";
import { AVISO_CONSTANCIA } from "@/lib/constancias-regla";

export const dynamic = "force-dynamic";

const RUTA = "/tutor/certificados";
const ESTADOS = { todas: "Todas", VALID: "Vigentes", REVOKED: "Revocadas" } as const;

const fecha = (f: Date) => {
  const p = etiquetaDiaMes(f);
  return `${p.dia} ${p.mes} ${p.anio}`;
};

type Params = { curso?: string; estado?: string; q?: string; pagina?: string };

/**
 * CONSTANCIAS de los cursos que dicta el tutor: cuántas se emitieron, el
 * ritmo de emisión de los últimos doce meses, el registro con su código
 * verificable y quiénes ya completaron un curso y aún no la tienen. Solo
 * consulta: la emisión y la revocación no son del tutor.
 */
export default async function TutorConstanciasPage({ searchParams }: { searchParams: Promise<Params> }) {
  const session = await requireTutorOrAdmin();
  const sp = await searchParams;
  const estado = (sp.estado && sp.estado in ESTADOS ? sp.estado : "todas") as keyof typeof ESTADOS;
  const q = sp.q?.trim() ?? "";
  const [{ cursos }, datos] = await Promise.all([
    getAlcanceTutor(session.user.id),
    getConstanciasTutor(session.user.id, { curso: sp.curso, estado, q, pagina: Number(sp.pagina) || 1 }),
  ]);
  const max = Math.max(1, ...datos.meses.map((m) => m.total));
  const url = (cambios: Partial<Params>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...cambios })) if (v) u.set(k, String(v));
    const s = u.toString();
    return s ? `${RUTA}?${s}` : RUTA;
  };

  return (
    <div className="space-y-5">
      <ModuloHero
        eyebrow="Personas · Registro de constancias"
        Icono={Award}
        titulo="Constancias de"
        acento="tus cursos"
        descripcion={`${AVISO_CONSTANCIA} Cada constancia lleva un código verificable públicamente; aquí consultas el registro y quién ya terminó la inducción sin tenerla todavía.`}
        cifras={[
          { valor: datos.resumen.validas, etiqueta: "Vigentes" },
          { valor: datos.resumen.delMes, etiqueta: "Emitidas este mes" },
          { valor: datos.resumen.pendientes, etiqueta: "Completaron sin constancia" },
          { valor: datos.resumen.revocadas, etiqueta: "Revocadas" },
        ]}
        acciones={
          <Link href="/tutor/inscritos?vista=cursos&estado=COMPLETED" className="enlace-hero">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Quiénes completaron
          </Link>
        }
      />

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-12">
        <PanelTutor
          indice="01"
          titulo="Registro"
          bajada={`${datos.total} ${datos.total === 1 ? "constancia" : "constancias"} con este filtro, las más recientes primero.`}
          className="xl:col-span-8"
          style={escalon(1)}
        >
          <form action={RUTA} className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-[minmax(0,2fr)_repeat(2,minmax(0,1fr))_auto] lg:items-end">
            <label className="enc-campo col-span-2 lg:col-span-1">
              <span>Buscar</span>
              <span className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input name="q" defaultValue={q} placeholder="Nombre, documento o código" className="enc-control enc-con-icono" />
              </span>
            </label>
            <label className="enc-campo">
              <span>Curso</span>
              <select name="curso" defaultValue={sp.curso ?? ""} className="enc-control">
                <option value="">Todos</option>
                {cursos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title.slice(0, 60)}
                  </option>
                ))}
              </select>
            </label>
            <label className="enc-campo">
              <span>Estado</span>
              <select name="estado" defaultValue={estado} className="enc-control">
                {Object.entries(ESTADOS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="enc-boton enc-boton-primario col-span-2 h-[2.4rem] justify-center lg:col-span-1">
              Filtrar
            </button>
          </form>

          {datos.filas.length === 0 ? (
            <VacioCompacto Icono={Award}>
              {cursos.length === 0 ? "No dictas cursos: las constancias se emiten sobre cursos completados." : "Ninguna constancia coincide con este filtro."}
            </VacioCompacto>
          ) : (
            <div className="-mx-1 overflow-x-auto px-1">
              <table className="tut-tabla min-w-[720px]">
                <thead>
                  <tr>
                    <th>Persona</th>
                    <th>Curso</th>
                    <th>Código</th>
                    <th>Emitida</th>
                    <th>Estado</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {datos.filas.map((c) => (
                    <tr key={c.id}>
                      <td className="max-w-[220px]">
                        <p className="truncate font-semibold text-foreground">{c.user.fullName}</p>
                        <p className="font-mono text-[10.5px] text-muted-foreground">{c.user.documentNumber}</p>
                      </td>
                      <td className="max-w-[240px]">
                        <p className="truncate text-[12.5px] text-foreground" title={c.course.title}>
                          {c.course.title}
                        </p>
                        <p className="font-mono text-[10.5px] text-muted-foreground">
                          {c.course.durationHours} h{c.enrollment.finalScore !== null ? ` · nota ${c.enrollment.finalScore}%` : ""}
                        </p>
                      </td>
                      <td className="whitespace-nowrap font-mono text-[11.5px] font-semibold text-foreground">{c.certificateCode}</td>
                      <td className="whitespace-nowrap font-mono text-[11px] text-muted-foreground">{fecha(c.issuedAt)}</td>
                      <td>
                        <span
                          className="tut-sello"
                          style={{ ["--tono" as string]: c.status === "VALID" ? "var(--success)" : "var(--destructive)" } as CSSProperties}
                          title={c.revokedReason ?? undefined}
                        >
                          {c.status === "VALID" ? "Vigente" : "Revocada"}
                        </span>
                      </td>
                      <td className="text-right">
                        <a href={`/validar/${encodeURIComponent(c.certificateCode)}`} target="_blank" rel="noreferrer" className="tut-enlace-panel">
                          Verificar
                          <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Paginacion pagina={datos.pagina} paginas={datos.paginas} total={datos.total} href={(n) => url({ pagina: String(n) })} />
        </PanelTutor>

        <div className="space-y-5 xl:col-span-4">
          <PanelTutor indice="02" titulo="Ritmo de emisión" bajada="Constancias vigentes emitidas por mes, últimos 12 meses." style={escalon(2)}>
            <div className="tut-meses" role="img" aria-label={`Constancias por mes: ${datos.meses.map((m) => `${etiquetaDiaMes(m.fecha).mes} ${m.total}`).join(", ")}`}>
              {datos.meses.map((m, i) => (
                <div key={m.clave} className="mes" data-actual={i === datos.meses.length - 1} title={`${etiquetaDiaMes(m.fecha).mes} ${etiquetaDiaMes(m.fecha).anio}: ${m.total}`}>
                  <span className="cifra">{m.total || ""}</span>
                  <span className="pista">
                    <span className="barra" style={{ height: `${m.total ? Math.max(6, (m.total / max) * 100) : 2}%`, animationDelay: `${i * 40}ms` }} />
                  </span>
                  <span className="etiqueta">{etiquetaDiaMes(m.fecha).mes.slice(0, 3)}</span>
                </div>
              ))}
            </div>
          </PanelTutor>

          <PanelTutor
            indice="03"
            titulo="Completaron sin constancia"
            bajada="Terminaron el curso y todavía no tienen constancia emitida."
            style={escalon(3)}
          >
            {datos.pendientes.length === 0 ? (
              <VacioCompacto Icono={BadgeCheck}>Nadie pendiente: todos los que completaron tienen su constancia.</VacioCompacto>
            ) : (
              <ul>
                {datos.pendientes.map((p) => (
                  <li key={p.id} className="tut-persona">
                    <span className="min-w-0">
                      <span className="block truncate text-foreground">{p.user.fullName}</span>
                      <span className="block truncate text-[10.5px] text-muted-foreground">{p.course.title}</span>
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{p.completedAt ? fecha(p.completedAt) : ""}</span>
                  </li>
                ))}
                {datos.resumen.pendientes > datos.pendientes.length && (
                  <li className="mono-label pt-2">+ {datos.resumen.pendientes - datos.pendientes.length} más</li>
                )}
              </ul>
            )}
          </PanelTutor>
        </div>
      </div>
    </div>
  );
}
