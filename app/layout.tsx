import type { Metadata } from "next";
import { Bricolage_Grotesque, Inter, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/brand/theme-provider";
import { NativeCssBypass } from "@/components/brand/native-css-bypass";
import { NativeViewTransitions } from "@/components/brand/native-view-transitions";
import "./globals.css";

// display: "swap" en las tres: el texto se pinta de inmediato con la fuente
// del sistema y se sustituye al llegar la definitiva, en vez de dejar la
// pantalla en blanco esperándolas (se midieron ~680ms entre TTFB y el primer
// pintado).
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  // Solo los pesos que la interfaz usa de verdad (font-bold y font-extrabold);
  // antes se descargaban cinco.
  weight: ["700", "800"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
      className={`${inter.variable} ${bricolage.variable} ${geistMono.variable} h-full antialiased`}
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
