import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Imágenes de curso y PDFs de lecciones pueden pesar varios MB.
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
