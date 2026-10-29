import { Sora } from "next/font/google";

/** Tipografía display de la SALA (titular, etiquetas técnicas): solo se carga ahí. */
export const fuenteSala = Sora({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-sala", display: "swap" });
