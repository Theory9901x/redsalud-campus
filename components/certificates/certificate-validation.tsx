"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, ShieldX, ShieldQuestion } from "lucide-react";
import { COURSE_TYPE_LABELS } from "@/components/cursos/labels";
import type { CourseType } from "@prisma/client";

type ValidationResult =
  | {
      state: "valid";
      certificateCode: string;
      studentName: string;
      documentType: string;
      documentNumber: string;
      courseTitle: string;
      courseType: CourseType;
      issuedAtLabel: string;
      institutionName: string;
    }
  | { state: "revoked"; certificateCode: string; institutionName: string }
  | { state: "not-found"; searchedCode: string; institutionName: string };

// El degradado de "anulado" se queda dentro del mismo matiz (destructive
// oscurecido hacia negro, no hacia navy): interpolar en oklch entre rojo
// (~21°) y navy (~249°) toma el arco más corto del círculo de matices, que
// pasa por magenta/púrpura -diluye la señal de "peligro" justo en el estado
// donde más importa que se lea inequívocamente como inválido-.
const SEAL_STYLES = {
  checking: { icon: ShieldQuestion, gradient: "linear-gradient(135deg in oklch, var(--muted-foreground), var(--navy))" },
  valid: { icon: ShieldCheck, gradient: "linear-gradient(135deg in oklch, var(--primary), var(--success))" },
  revoked: {
    icon: ShieldX,
    gradient: "linear-gradient(135deg in oklch, var(--destructive), color-mix(in oklch, var(--destructive) 55%, black))",
  },
  "not-found": { icon: ShieldQuestion, gradient: "linear-gradient(135deg in oklch, var(--muted-foreground), var(--navy))" },
} as const;

/**
 * Momento signature 4: la única pantalla de este LMS pensada para gente
 * FUERA de la institución. El sello es el centro real de la composición
 * (no un badge de esquina), y la verificación se presenta como un momento
 * -no solo un resultado que ya estaba resuelto en el servidor-: primero un
 * sello neutro "verificando", que se resuelve con un pop de confirmación
 * hacia el estado real. prefers-reduced-motion salta directo al resultado.
 */
export function CertificateValidation({ result }: { result: ValidationResult }) {
  const [phase, setPhase] = useState<"checking" | "settled">("checking");

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase("settled");
      return;
    }
    const timer = setTimeout(() => setPhase("settled"), 700);
    return () => clearTimeout(timer);
  }, []);

  const sealKey = phase === "checking" ? "checking" : result.state;
  const Seal = SEAL_STYLES[sealKey];

  return (
    <div className="page-canvas flex min-h-screen flex-col">
      <header className="border-b border-border bg-card/80 px-4 py-3.5 backdrop-blur sm:px-6">
        <a href="/" className="flex w-fit items-center gap-2">
          <span className="font-display text-sm font-extrabold text-foreground">RedSalud Te Forma</span>
        </a>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="surface surface-panel w-full max-w-md p-8 text-center sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {result.institutionName}
          </p>

          <div className="relative mx-auto mt-8 flex h-32 w-32 items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={sealKey}
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={
                  phase === "checking"
                    ? { duration: 0.3 }
                    : { type: "spring", stiffness: 300, damping: 16 }
                }
                className="flex h-28 w-28 items-center justify-center rounded-full text-white shadow-[0_16px_40px_-12px_color-mix(in_oklch,var(--navy)_45%,transparent)]"
                style={{ background: Seal.gradient }}
              >
                <Seal.icon className={phase === "checking" ? "h-11 w-11 animate-pulse" : "h-14 w-14"} strokeWidth={1.75} />
              </motion.div>
            </AnimatePresence>
            {phase === "checking" && (
              <span className="absolute inset-0 animate-ping rounded-full border-2 border-muted-foreground/30" />
            )}
          </div>

          <AnimatePresence mode="wait">
            {phase === "checking" ? (
              <motion.p
                key="checking-label"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mt-6 text-sm font-medium text-muted-foreground"
              >
                Verificando certificado...
              </motion.p>
            ) : (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.4 }}
              >
                {result.state === "valid" && (
                  <>
                    <h1 className="mt-6 font-display text-2xl font-extrabold text-foreground">Certificado válido</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Este certificado fue emitido por {result.institutionName}.
                    </p>
                    <dl className="mt-6 space-y-2 text-left text-sm">
                      <div className="flex justify-between border-b border-border pb-2">
                        <dt className="text-muted-foreground">Nombre</dt>
                        <dd className="font-medium text-foreground">{result.studentName}</dd>
                      </div>
                      <div className="flex justify-between border-b border-border pb-2">
                        <dt className="text-muted-foreground">Documento</dt>
                        <dd className="font-medium text-foreground">
                          {result.documentType} {result.documentNumber}
                        </dd>
                      </div>
                      <div className="flex justify-between border-b border-border pb-2">
                        <dt className="text-muted-foreground">Curso</dt>
                        <dd className="text-right font-medium text-foreground">{result.courseTitle}</dd>
                      </div>
                      <div className="flex justify-between border-b border-border pb-2">
                        <dt className="text-muted-foreground">Tipo</dt>
                        <dd className="font-medium text-foreground">{COURSE_TYPE_LABELS[result.courseType]}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Fecha de emisión</dt>
                        <dd className="font-medium text-foreground">{result.issuedAtLabel}</dd>
                      </div>
                    </dl>
                    <p className="mt-6 font-mono text-xs text-muted-foreground">{result.certificateCode}</p>
                  </>
                )}

                {result.state === "revoked" && (
                  <>
                    <h1 className="mt-6 font-display text-2xl font-extrabold text-foreground">Certificado anulado</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Este certificado fue anulado por la institución y ya no es válido.
                    </p>
                    <p className="mt-6 font-mono text-xs text-muted-foreground">{result.certificateCode}</p>
                  </>
                )}

                {result.state === "not-found" && (
                  <>
                    <h1 className="mt-6 font-display text-2xl font-extrabold text-foreground">
                      Certificado no encontrado
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                      El código no corresponde a ningún certificado emitido. Verifica que esté escrito exactamente
                      como aparece en el documento.
                    </p>
                    <p className="mt-6 font-mono text-xs text-muted-foreground">{result.searchedCode}</p>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
