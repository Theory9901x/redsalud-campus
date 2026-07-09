import type { Variants } from "framer-motion";

/**
 * Firma de movimiento de RedSalud Te Forma. Misma curva que
 * --ease-signature en app/globals.css (ahí para transiciones CSS puras,
 * acá para Framer Motion) -- un solo lenguaje de movimiento en toda la
 * plataforma, no timings sueltos por componente.
 */
export const SIGNATURE_EASE = [0.16, 1, 0.3, 1] as const;
export const SIGNATURE_DURATION_FAST = 0.2;
export const SIGNATURE_DURATION = 0.4;
export const SIGNATURE_DURATION_SLOW = 0.6;

export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06 },
  },
};

export const fadeSlideUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: SIGNATURE_DURATION, ease: SIGNATURE_EASE } },
};
