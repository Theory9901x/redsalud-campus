import type { Metadata } from "next";
import { Sora, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/brand/theme-provider";
import { NativeCssBypass } from "@/components/brand/native-css-bypass";
import { NativeViewTransitions } from "@/components/brand/native-view-transitions";
import "./globals.css";

// Tipografía del sistema (oct-2026), "centro de mando":
//  · Sora (títulos): geométrica y precisa, con aire tecnológico sin perder
//    seriedad institucional.
//  · Instrument Sans (texto): contemporánea y muy legible en tamaños chicos
//    -tablas, formularios, metadatos-.
//  · JetBrains Mono (datos): cifras y etiquetas de telemetría con carácter.
// display: "swap" en las tres: el texto se pinta de inmediato con la fuente
// del sistema y se sustituye al llegar la definitiva.
const cuerpo = Instrument_Sans({
  variable: "--font-cuerpo",
  subsets: ["latin"],
  display: "swap",
});

const titulo = Sora({
  variable: "--font-titulo",
  subsets: ["latin"],
  // Pesos que usa la interfaz en títulos (semibold, bold, extrabold).
  weight: ["600", "700", "800"],
  display: "swap",
});

const mono = JetBrains_Mono({
  variable: "--font-datos",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "RedSalud Te Forma — Campus Virtual",
  description: "Campus virtual de capacitación institucional de Red Salud Casanare E.S.E.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: el script bloqueante de next-themes escribe la
    // clase del tema en <html> antes de que React hidrate, así que el marcado
    // del servidor y el del cliente difieren a propósito en ese atributo.
    <html
      lang="es"
      suppressHydrationWarning
      className={`${cuerpo.variable} ${titulo.variable} ${mono.variable} h-full antialiased`}
    >
      <head>
        <NativeCssBypass />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider>
          <NativeViewTransitions />
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
