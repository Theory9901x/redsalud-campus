import Link from "next/link";
import { Award, ExternalLink, Mail, MapPin, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PanelDescription, PanelHeader, PanelTitle } from "@/components/admin/dashboard/panel-persona";
import { getDetallePersona } from "@/lib/admin-dashboard";

const FECHA: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };

/**
 * Contenido del panel lateral: se arma en el servidor a partir del `?persona`
 * de la URL, así que no hace falta ningún endpoint ni enviar la ficha entera
 * de cada persona al cliente solo por si alguien hace clic en una fila.
 */
export async function DetallePersona({ id }: { id: string }) {
  const persona = await getDetallePersona(id);

  if (!persona) {
    return (
      <>
        <PanelHeader>
          <PanelTitle>Persona no encontrada</PanelTitle>
          <PanelDescription>Puede que la hayan eliminado desde otra sesión.</PanelDescription>
        </PanelHeader>
      </>
    );
  }

  const credencial = persona.email ?? persona.username;

  return (
    <>
      <PanelHeader>
        <PanelTitle className="text-balance">{persona.fullName}</PanelTitle>
        <PanelDescription>
          {persona.documentType} {persona.documentNumber}
          {persona.position ? ` · ${persona.position}` : ""}
        </PanelDescription>
      </PanelHeader>

      <div className="space-y-5 px-4 pb-6">
        {/* Datos de contacto */}
        <dl className="space-y-1.5 text-sm">
          {credencial && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 truncate text-foreground">{credencial}</span>
            </div>
          )}
          {persona.phone && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-3.5 w-3.5 shrink-0" />
              <span className="text-foreground">{persona.phone}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="text-foreground">{persona.municipio?.nombre ?? "Sin municipio"}</span>
            <Badge variant="secondary" className="ml-1">
              {persona.personnelType === "ASISTENCIAL" ? "Asistencial" : "Administrativo"}
            </Badge>
          </div>
        </dl>

        <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          {persona.lastLoginAt
            ? `Último ingreso: ${persona.lastLoginAt.toLocaleDateString("es-CO", FECHA)}`
            : "Nunca ha ingresado a la plataforma."}
        </p>

        {/* Formación */}
        <section className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Formación asignada</h3>
          {persona.enrollments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tiene cursos asignados.</p>
          ) : (
            <ul className="space-y-2">
              {persona.enrollments.map((e) => (
                <li key={e.id} className="rounded-lg border border-border p-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 text-sm font-medium text-foreground">{e.course.title}</span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {e.progressPercentage}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${e.progressPercentage}%`,
                        backgroundColor: e.status === "COMPLETED" ? "var(--data-1)" : "var(--data-3)",
                      }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {e.status === "COMPLETED" && e.completedAt
                      ? `Completado el ${e.completedAt.toLocaleDateString("es-CO", FECHA)}`
                      : e.progressPercentage > 0
                        ? "En curso"
                        : "Sin empezar"}
                    {e.finalScore !== null && ` · Nota final ${e.finalScore}%`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Certificados */}
        {persona.certificates.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Certificados</h3>
            <ul className="space-y-1.5">
              {persona.certificates.map((c) => (
                <li key={c.id} className="flex items-center gap-2 text-sm">
                  <Award className="h-3.5 w-3.5 shrink-0 text-[var(--data-1)]" />
                  <span className="min-w-0 flex-1 truncate text-foreground">{c.course.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {c.issuedAt.toLocaleDateString("es-CO", FECHA)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <Link
          href={`/admin/usuarios/${persona.id}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          Abrir ficha completa
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>
    </>
  );
}
