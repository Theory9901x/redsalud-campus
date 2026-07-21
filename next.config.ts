import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Todas las imágenes reales de la plataforma son archivos subidos en
    // runtime (/uploads, servido directo por nginx en producción). El
    // optimizador de Next las re-escalaba (se veían pixeladas) y además
    // cacheaba 404 para archivos subidos después del build. Se sirven en su
    // resolución original.
    unoptimized: true,
  },
  experimental: {
    serverActions: {
      // Imágenes de curso y PDFs de lecciones pueden pesar varios MB.
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
