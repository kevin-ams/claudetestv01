import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Copia independiente para marketing (tiene su propio lint).
    "eos-marketing/**",
    // Skill de HeroUI para el agente (scripts de consulta de documentación).
    ".claude/**",
  ]),
]);

export default eslintConfig;
