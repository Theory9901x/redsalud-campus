import { Rajdhani } from "next/font/google";

/** Tipografía display de la SALA (etiquetas técnicas, titulares): solo se carga ahí. */
export const fuenteSala = Rajdhani({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-sala", display: "swap" });
