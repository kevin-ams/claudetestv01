// Revisa que el JavaScript que se envía al navegador (.next/static) no contenga secretos (ISO 27001 8.9 / 8.12):
// ni lecturas de variables secretas (process.env.X) ni valores con forma de clave. Mencionar el NOMBRE de una
// variable en un texto de ayuda ("Falta RESEND_API_KEY en Netlify") está bien: no revela nada.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = path.join(path.dirname(path.dirname(new URL(import.meta.url).pathname)), ".next", "static");
const SECRET_NAMES = ["AUTH_SECRET", "CRON_SECRET", "RESEND_API_KEY", "ACTIVECAMPAIGN_API_KEY", "CLICKUP_API_TOKEN", "ANTHROPIC_API_KEY", "NETLIFY_DB_URL"];
const VALUE_PATTERNS = [
  /sk-ant-[A-Za-z0-9_-]{20,}/, // Anthropic
  /re_[A-Za-z0-9]{20,}/, // Resend
  /pk_[0-9]+_[A-Z0-9]{20,}/, // ClickUp
  /postgres(?:ql)?:\/\/[^\s"']+:[^\s"']+@/, // cadena de conexión con contraseña
];

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) yield* files(p);
    else if (/\.(js|mjs|css|html|json)$/.test(name)) yield p;
  }
}

let problems = 0;
let count = 0;
for (const file of files(root)) {
  count++;
  const text = readFileSync(file, "utf8");
  for (const n of SECRET_NAMES) {
    if (new RegExp(`env\\.${n}\\b|env\\[["']${n}["']\\]`).test(text)) {
      problems++;
      console.error(`[secretos] ${path.relative(root, file)} lee ${n} en el navegador`);
    }
  }
  for (const re of VALUE_PATTERNS) {
    if (re.test(text)) {
      problems++;
      console.error(`[secretos] ${path.relative(root, file)} tiene un valor con forma de clave (${re})`);
    }
  }
}
if (problems) {
  console.error(`[secretos] ${problems} problema(s) en ${count} archivos del navegador.`);
  process.exit(1);
}
console.log(`[secretos] OK: ${count} archivos del navegador sin secretos.`);
