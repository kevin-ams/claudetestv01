import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // La app vive en una subcarpeta del repositorio, que tiene otro lockfile.
  turbopack: { root: __dirname },
};

export default nextConfig;
