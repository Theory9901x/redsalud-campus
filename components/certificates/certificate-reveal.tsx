"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Award, Download, Share2, ArrowRight, ShieldCheck } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { COURSE_TYPE_COLORS } from "@/components/cursos/labels";
import type { CourseType, CertificateStatus } from "@prisma/client";

type Particle = { angle: number; distance: number; delay: number; size: number; color: "primary" | "success" | "warning" };

/** Estalla una sola vez desde el sello: se genera solo en cliente, después del montaje, para no desincronizar el HTML del servidor con valores aleatorios. */
function useConfettiBurst(enabled: boolean) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!enabled) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const colors: Particle["color"][] = ["primary", "success", "warning"];
    const next = Array.from({ length: 22 }, (_, i) => ({
      angle: (360 / 22) * i + (Math.random() * 20 - 10),
      distance: 70 + Math.random() * 60,
      delay: Math.random() * 0.15,
      size: 5 + Math.random() * 5,
      color: colors[i % colors.length],
    }));
    setParticles(next);
  }, [enabled]);

  return particles;
}

const PARTICLE_COLOR_VAR: Record<Particle["color"], string> = {
  primary: "var(--primary)",
  success: "var(--success)",
  warning: "var(--warning)",
};

export function CertificateReveal({
  justIssued,
  certificateCode,
  issuedAt,
  status,
  studentName,
  courseTitle,
  courseTypeLabel,
  courseType,
  durationHours,
  institutionName,
  pdfUrl,
  validationUrl,
}: {
  justIssued: boolean;
  certificateCode: string;
  issuedAt: string;
  status: CertificateStatus;
  studentName: string;
  courseTitle: string;
  courseTypeLabel: string;
  courseType: CourseType;
  durationHours: number;
  institutionName: string;
  pdfUrl: string;
  validationUrl: string;
}) {
  const firstName = studentName.split(" ")[0];
  const colors = COURSE_TYPE_COLORS[courseType];
  const particles = useConfettiBurst(justIssued);
  const formattedDate = new Date(issuedAt).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  async function handleShare() {
    const url = `${window.location.origin}${validationUrl}`;
    const shareData = {
      title: `Certificado — ${courseTitle}`,
      text: `Verifica mi certificado de "${courseTitle}" emitido por ${institutionName}.`,
      url,
    };
    if (navigator.share && navigator.canShare?.(shareData)) {
      try {
        await navigator.share(shareData);
      } catch {
        // El usuario canceló el diálogo nativo: no es un error real.
      }
      return;
    }
    await navigator.clipboard.writeText(url);
    toast.success("Enlace de validación copiado al portapapeles.");
  }

  return (
    <main className="relative isolate min-h-[calc(100vh-4rem)] overflow-hidden bg-navy px-4 py-12 text-white sm:px-6 sm:py-16">
      {/* Lienzo de fondo: mismo lenguaje de gradientes de marca que el resto de la app, pero a toda pantalla -- este es un Momento Signature, no otra sección más. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle at 12% -10%, color-mix(in oklch, var(--primary) 35%, transparent), transparent 55%), radial-gradient(circle at 88% 110%, color-mix(in oklch, var(--success) 25%, transparent), transparent 55%)",
        }}
      />

      <div className="relative mx-auto flex max-w-3xl flex-col items-center text-center">
        <motion.span
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/80 ring-1 ring-white/15"
        >
          <Award className="h-3.5 w-3.5 text-warning" />
          Certificado emitido
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.1 }}
          className="text-display-xl mt-4 font-display font-extrabold"
        >
          Felicitaciones, {firstName}.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-3 max-w-xl text-balance text-base text-white/70"
        >
          Completaste <span className="font-semibold text-white">{courseTitle}</span> y tu certificado ya está listo
          para descargar y compartir.
        </motion.p>

        {/* El "documento": materializa con escala + desenfoque + una ligera rotación de entrada, no un fade plano -- ver @keyframes certificate-shine para el barrido de brillo. */}
        <motion.div
          initial={{ opacity: 0, scale: 0.86, rotate: -3, filter: "blur(10px)" }}
          animate={{ opacity: 1, scale: 1, rotate: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.7, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="relative mt-10 w-full max-w-2xl"
        >
          <div className="certificate-shine relative overflow-hidden rounded-[28px] border border-white/15 bg-gradient-to-br from-white to-[oklch(97.5%_0.004_258)] p-8 text-navy shadow-[0_30px_80px_-20px_rgba(0,0,0,0.55)] sm:p-12">
            <div
              className="pointer-events-none absolute inset-0 rounded-[28px] p-[2px]"
              style={{
                background: "linear-gradient(120deg in oklch, var(--primary), var(--success), var(--warning), var(--primary))",
                WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                WebkitMaskComposite: "xor",
                maskComposite: "exclude",
              }}
            />

            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{institutionName}</p>
            <p className={cn("mt-1 text-xs font-bold uppercase tracking-widest", colors.badge, "inline-block rounded-full px-2.5 py-1")}>
              {courseTypeLabel}
            </p>
            <h2 className="mt-6 font-display text-3xl font-extrabold leading-tight text-balance sm:text-4xl">
              {studentName}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">ha completado satisfactoriamente el curso</p>
            <p className="mt-1 text-lg font-bold text-navy text-balance sm:text-xl">{courseTitle}</p>

            <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-navy/10 pt-5 text-left text-xs text-muted-foreground">
              <div>
                <p className="font-semibold text-navy">{durationHours}h de intensidad horaria</p>
                <p>Emitido el {formattedDate}</p>
              </div>
              <p className="font-mono text-navy">{certificateCode}</p>
            </div>

            {/* El sello: entra después de que el documento se asienta, como si se estampara. */}
            <motion.div
              initial={{ scale: 0, rotate: -25, opacity: 0 }}
              animate={{ scale: 1, rotate: -12, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.95 }}
              className="absolute -right-4 -top-4 flex h-20 w-20 items-center justify-center rounded-full text-white shadow-lg sm:-right-6 sm:-top-6 sm:h-24 sm:w-24"
              style={{ background: `linear-gradient(135deg in oklch, var(--primary), var(--success))` }}
            >
              <ShieldCheck className="h-9 w-9 sm:h-11 sm:w-11" strokeWidth={1.75} />

              {particles.map((p, i) => (
                <span
                  key={i}
                  className="confetti-particle"
                  style={
                    {
                      "--angle": `${p.angle}deg`,
                      "--distance": `${p.distance}px`,
                      "--delay": `${p.delay}s`,
                      "--size": `${p.size}px`,
                      "--color": PARTICLE_COLOR_VAR[p.color],
                    } as React.CSSProperties
                  }
                />
              ))}
            </motion.div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-3"
        >
          <a
            href={pdfUrl}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ size: "lg" }), "gap-2 bg-gradient-to-r from-primary to-success text-white hover:opacity-90")}
          >
            <Download className="h-4 w-4" />
            Descargar certificado (PDF)
          </a>
          <button
            type="button"
            onClick={handleShare}
            className={cn(buttonVariants({ variant: "outline", size: "lg" }), "gap-2 border-white/25 bg-white/5 text-white hover:bg-white/10")}
          >
            <Share2 className="h-4 w-4" />
            Compartir
          </button>
          <Link
            href="/mi-aula#mis-certificados"
            className={cn(buttonVariants({ variant: "ghost", size: "lg" }), "gap-1.5 text-white/70 hover:bg-white/10 hover:text-white")}
          >
            Ver en mi historial
            <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>

        {status === "REVOKED" && (
          <p className="mt-6 rounded-lg bg-destructive/20 px-4 py-2 text-sm text-destructive-foreground">
            Este certificado fue anulado posteriormente y ya no es válido para verificación.
          </p>
        )}
      </div>
    </main>
  );
}
