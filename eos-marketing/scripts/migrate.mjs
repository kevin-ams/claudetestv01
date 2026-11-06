// Aplica las migraciones pendientes en Netlify Database como paso del build/deploy.
// Si no hay base en la nube (desarrollo local, o un build sin NETLIFY_DB_URL), no hace nada:
// la app las aplica al arrancar como respaldo. Si una migración falla, el build falla y
// la versión publicada sigue siendo la anterior (en vez de romperse en la primera visita).
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const SCHEMA = "eos_marketing";
const url = process.env.EOS_FORCE_LOCAL_DB === "1" ? null : process.env.NETLIFY_DB_URL;
if (!url) {
  console.log("[migrate] sin NETLIFY_DB_URL: se omiten (la app las aplica al arrancar)");
  process.exit(0);
}

const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const dir = path.join(root, "db", "migrations");
const migrations = readdirSync(dir).sort().map((name) => ({ name, sql: readFileSync(path.join(dir, name, "migration.sql"), "utf8") }));

const { Pool } = await import("@neondatabase/serverless");
const pool = new Pool({ connectionString: url });
const client = await pool.connect();
const started = Date.now();
try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(84210517)");
  await client.query(`CREATE SCHEMA IF NOT EXISTS ${SCHEMA}`);
  await client.query(`SET LOCAL search_path TO ${SCHEMA}`);
  await client.query(`CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  const applied = new Set((await client.query("SELECT name FROM _migrations")).rows.map((r) => r.name));
  let count = 0;
  for (const m of migrations) {
    if (applied.has(m.name)) continue;
    const t = Date.now();
    await client.query(m.sql);
    await client.query("INSERT INTO _migrations (name) VALUES ($1)", [m.name]);
    console.log(`[migrate] ${m.name} (${Date.now() - t} ms)`);
    count++;
  }
  await client.query("COMMIT");
  console.log(`[migrate] ${count} aplicada(s), ${migrations.length} en total (${Date.now() - started} ms)`);
} catch (e) {
  await client.query("ROLLBACK").catch(() => {});
  console.error("[migrate] falló; no se aplicó ninguna:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end().catch(() => {});
}
