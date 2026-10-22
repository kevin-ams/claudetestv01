import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Mientras el CRM vive dentro de otro repositorio, fija su raíz explícitamente.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
