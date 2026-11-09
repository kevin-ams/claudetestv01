import path from "node:path";
import { defineConfig } from "vitest/config";

// Pruebas: `npm test`. Las de integración usan PGlite en una carpeta temporal (ver tests/setup.ts).
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // "server-only" solo protege el bundle del navegador; en las pruebas no hace nada.
      "server-only": path.resolve(import.meta.dirname, "tests/server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    // Una sola base de datos por corrida: los archivos se ejecutan uno tras otro.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
