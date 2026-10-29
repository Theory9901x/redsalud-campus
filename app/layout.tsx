import type { Metadata } from "next";
import { Instrument_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/brand/theme-provider";
import { NativeCssBypass } from "@/components/brand/native-css-bypass";
import { NativeViewTransitions } from "@/components/brand/native-view-transitions";
import "./globals.css";

// Una sola familia tipográfica para todo el campus.
const cuerpo = Instrument_Sans({
  variable: "--font-cuerpo",
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
      className={`${cuerpo.variable} h-full antialiased`}
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
