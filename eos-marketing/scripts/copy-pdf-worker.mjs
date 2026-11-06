// Copia el worker de pdf.js a /public para el conversor de PDF a nota (Conocimiento).
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const src = path.join(path.dirname(require.resolve("pdfjs-dist/package.json")), "build", "pdf.worker.min.mjs");
mkdirSync("public", { recursive: true });
copyFileSync(src, path.join("public", "pdf.worker.min.mjs"));
console.log("[pdf.js] worker copiado a public/pdf.worker.min.mjs");
