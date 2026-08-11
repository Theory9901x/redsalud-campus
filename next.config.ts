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
  async redirects() {
    return [
      {
        // "Mis encuestas" pasó a llamarse "Evaluaciones de capacitación":
        // el nombre no reflejaba lo que hay dentro (presaber y postsaber,
        // no solo encuestas). Se conserva la ruta vieja para que ningún
        // enlace guardado quede roto.
        source: "/mis-encuestas",
        destination: "/evaluaciones",
        permanent: true,
      },
      {
        source: "/mis-encuestas/:id",
        destination: "/evaluaciones/:id",
        permanent: true,
      },
    ];
  },
  experimental: {
    serverActions: {
      // Imágenes de curso y PDFs de lecciones pueden pesar varios MB.
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
