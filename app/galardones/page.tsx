import { CheckCircle2, Lock, Trophy } from "lucide-react";
import { requireSession } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { veComoAdmin } from "@/lib/roles";
import { CabeceraGalardones } from "@/components/galardones/escena";
import { FormularioPostulacion } from "@/components/galardones/formulario-postulacion";
import { estadoConvocatoria, postulacionDe } from "@/lib/galardones/consultas";
import { ipsDesdeMunicipio } from "@/lib/galardones/ips";
import { NOMBRE_RECONOCIMIENTO, valorInfo } from "@/lib/galardones/valores";
import { nombrePropio } from "@/lib/nombre-propio";

const FECHA = new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeZone: "America/Bogota" });
const FECHA_HORA = new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeStyle: "short", timeZone: "America/Bogota" });

/**
 * POSTULACIÓN a la Galardones. Una por colaborador: si ya la hizo,
 * ve lo que registró; si la convocatoria cerró, lo sabe. La identidad la da
 * la sesión del campus, que es lo que permite que cada quien postule una
 * sola vez sin pedirle datos.
 */
export default async function GalardonesPage() {
  const sesion = await requireSession("/galardones");
  const [usuario, ajustes, convocatoria, hecha] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: sesion.user.id },
      select: { fullName: true, municipio: { select: { nombre: true } } },
    }),
    prisma.institutionSettings.findUnique({ where: { id: "singleton" }, select: { institutionName: true, logoUrl: true } }),
    estadoConvocatoria(),
    postulacionDe(sesion.user.id),
  ]);

  const volverA = veComoAdmin(sesion.user.role) ? "/admin" : sesion.user.role === "TUTOR" ? "/tutor" : "/inicio";

  return (
    <main className="gala-lienzo">
      <CabeceraGalardones
        logoUrl={ajustes?.logoUrl ?? null}
        institucion={ajustes?.institutionName ?? "Red Salud Casanare E.S.E."}
        volverA={volverA}
        volverTexto="Volver al campus"
        anio={convocatoria.anio}
      />

      <section>
        <span className="gala-eyebrow">Reconocimiento al mérito · Código de Integridad</span>
        <h1 className="gala-titulo">
          <span className="brillo">{NOMBRE_RECONOCIMIENTO}</span>
        </h1>
        <p className="gala-lead">
          Destaca a quienes, con su ejemplo, fortalecen la confianza, el buen trato y el trabajo colaborativo. Postula a una
          persona de tu centro por cada valor: <b>Integridad</b>, <b>Humanización</b> y <b>Liderazgo</b>.
        </p>
      </section>

      {hecha ? (
        <section className="gala-panel gala-panel-borde gala-hecho mt-8" aria-labelledby="hecho-titulo">
          <div className="gala-hecho-icono">
            <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
          </div>
          <span className="gala-mono">Postulación registrada</span>
          <h2 id="hecho-titulo" className="mt-2 text-2xl font-extrabold tracking-tight">
            Gracias, {nombrePropio(usuario.fullName).split(" ")[0]}
          </h2>
          <p className="mx-auto mt-2 max-w-[48ch] text-sm" style={{ color: "var(--g-muted)" }}>
            Tu postulación para el centro <b style={{ color: "var(--g-text)" }}>{hecha.ips}</b> quedó registrada el{" "}
            {FECHA_HORA.format(hecha.enviadaEl)}. Cada colaborador la diligencia una única vez.
          </p>
          {hecha.estado === "POR_VERIFICAR" && (
            <p className="gala-sello mx-auto mt-4">
              Tu cuenta es reciente: Talento Humano verificará tu postulación antes de que sume en los resultados.
            </p>
          )}
          <div className="gala-resumen mx-auto mt-6 max-w-2xl text-left">
            {hecha.valores.map((v) => {
              const info = valorInfo(v.valor);
              return (
                <div key={v.valor} className="gala-resumen-fila" style={{ ["--g-h" as string]: info.matiz }}>
                  <span className="gala-mono">
                    {info.numero}. {info.nombre}
                  </span>
                  <div>
                    <b>{v.nombre}</b>
                    <p>{v.motivo}</p>
                  </div>
                  <Trophy className="h-4 w-4" style={{ color: "var(--g-a)" }} aria-hidden="true" />
                </div>
              );
            })}
          </div>
        </section>
      ) : !convocatoria.abierta ? (
        <section className="gala-panel gala-hecho mt-8">
          <div className="gala-hecho-icono" style={{ background: "var(--g-panel-2)", color: "var(--g-muted)", boxShadow: "none", animation: "none" }}>
            <Lock className="h-7 w-7" aria-hidden="true" />
          </div>
          <span className="gala-mono">Convocatoria cerrada</span>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight">Las postulaciones ya cerraron</h2>
          <p className="mx-auto mt-2 max-w-[46ch] text-sm" style={{ color: "var(--g-muted)" }}>
            {convocatoria.cierraEl ? `El plazo terminó el ${FECHA.format(convocatoria.cierraEl)}. ` : ""}
            Talento Humano consolida la información para continuar con la selección de las personas reconocidas.
          </p>
        </section>
      ) : (
        <FormularioPostulacion
          nombreVotante={nombrePropio(usuario.fullName)}
          ipsSugerida={ipsDesdeMunicipio(usuario.municipio?.nombre)}
          cierraEl={convocatoria.cierraEl ? FECHA.format(convocatoria.cierraEl) : null}
        />
      )}
    </main>
  );
}
