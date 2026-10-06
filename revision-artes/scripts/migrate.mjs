// Aplica las migraciones de netlify/database/migrations a la base local
// indicada en DATABASE_URL. Cada migración se aplica una sola vez.
// Uso: npm run db:migrate
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Falta DATABASE_URL (revisa tu archivo .env.local)");
  process.exit(1);
}

const dir = path.join(import.meta.dirname, "..", "netlify", "database", "migrations");
const client = new pg.Client({ connectionString: url });
await client.connect();

try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS _migraciones (
      nombre TEXT PRIMARY KEY,
      aplicada_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  const { rows } = await client.query("SELECT nombre FROM _migraciones");
  const aplicadas = new Set(rows.map((r) => r.nombre));

  const nombres = (await readdir(dir)).sort();
  for (const nombre of nombres) {
    if (aplicadas.has(nombre)) continue;
    const sql = await readFile(path.join(dir, nombre, "migration.sql"), "utf8");
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO _migraciones (nombre) VALUES ($1)", [nombre]);
      await client.query("COMMIT");
      console.log(`✔ ${nombre}`);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  }
  console.log("Base de datos al día.");
} finally {
  await client.end();
}
