import Image from "next/image";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}

/**
 * Ficha del curso: quién lo creó (tutor responsable) y quién lo certifica
 * (institución, vía InstitutionSettings — dato global ya existente, no una
 * relación nueva por curso). El avatar del tutor NO se carga por su Media
 * privado: /api/media/[id] exige sesión y no autoriza a un visitante
 * anónimo ni a otro estudiante a verlo, así que se usan iniciales.
 */
export function CourseCreatorCard({
  tutorName,
  institution,
}: {
  tutorName: string;
  institution: {
    name: string;
    logoUrl: string | null;
    signerName: string | null;
    signerPosition: string | null;
  } | null;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
          {initials(tutorName)}
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tutor responsable</p>
          <p className="truncate font-display text-sm font-bold text-foreground">{tutorName}</p>
        </div>
      </div>

      {institution && (
        <div className="flex items-center gap-3 border-t border-border pt-4">
          {institution.logoUrl ? (
            <Image
              src={institution.logoUrl}
              alt={institution.name}
              width={44}
              height={44}
              className="h-11 w-11 shrink-0 rounded-full bg-white object-contain ring-1 ring-border"
            />
          ) : (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-sm font-bold text-foreground">
              {initials(institution.name)}
            </span>
          )}
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Certificado por</p>
            <p className="truncate font-display text-sm font-bold text-foreground">{institution.name}</p>
            {institution.signerName && (
              <p className="truncate text-xs text-muted-foreground">
                {institution.signerName}
                {institution.signerPosition ? ` · ${institution.signerPosition}` : ""}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
