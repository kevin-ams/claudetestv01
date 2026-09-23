import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Proyecto independiente dentro del repo: fija la raíz a esta carpeta.
  outputFileTracingRoot: __dirname,
  turbopack: { root: __dirname },
  // PGlite carga su propio WASM; se ejecuta con el require nativo de Node.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
