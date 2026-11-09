import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Seguridad (ISO 27001 8.9): las variables de entorno solo se leen en src/lib/config (validadas, sin secretos por omisión).
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-properties": [
        "error",
        { object: "process", property: "env", message: "Lee la configuración con config de @/lib/config/server (o TIMEZONE de @/lib/config/shared)." },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
