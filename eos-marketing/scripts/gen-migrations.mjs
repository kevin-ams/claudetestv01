// Empaqueta db/migrations en un módulo TypeScript para la versión en la nube
// (en Netlify las funciones no leen archivos sueltos del proyecto).
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const dir = path.join(root, "db", "migrations");
const migrations = readdirSync(dir)
  .sort()
  .map((name) => ({ name, sql: readFileSync(path.join(dir, name, "migration.sql"), "utf8") }));
const out = `// Generado por scripts/gen-migrations.mjs a partir de db/migrations. No editar a mano.
export const MIGRATIONS: { name: string; sql: string }[] = ${JSON.stringify(migrations, null, 2)};
`;
writeFileSync(path.join(root, "src", "lib", "db-migrations.generated.ts"), out);
console.log(`[migraciones] ${migrations.length} empaquetadas`);
