import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Permite subir el Excel de la campaña de llamadas (ver /llamadas).
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
};

export default nextConfig;
