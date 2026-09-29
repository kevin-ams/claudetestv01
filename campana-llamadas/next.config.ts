import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Esta app vive en una subcarpeta del repositorio; su raíz es esta carpeta.
  turbopack: {
    root: process.cwd(),
  },
  experimental: {
    // Permite subir el Excel de la campaña.
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
};

export default nextConfig;
