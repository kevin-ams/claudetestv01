import "server-only";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { PGlite } from "@electric-sql/pglite";

/**
 * Base de datos de la app.
 * - En tu computadora: Postgres embebido (PGlite) en `.data/pglite`, sin servidor.
 * - En Netlify: Netlify Database (Postgres), dentro del esquema `eos_marketing`
 *   para no mezclarse con otras tablas que ya existan en esa base.
 * Ambas aplican las migraciones de `db/migrations` automáticamente.
 */

type Row = Record<string, unknown>;
type Db = {
  sql: (strings: TemplateStringsArray, ...params: unknown[]) => Promise<Row[]>;
  /** Consulta con texto y parámetros ($1, $2…), para inserciones en lote. */
  query: (text: string, params: unknown[]) => Promise<Row[]>;
};
type Backend = { query: (text: string, params: unknown[]) => Promise<Row[]> };

export const CLOUD_SCHEMA = "eos_marketing";

/** Convierte un template `sql` en texto con $1, $2… y sus parámetros. */
function toQuery(strings: TemplateStringsArray, params: unknown[]) {
  let text = strings[0];
  for (let i = 1; i < strings.length; i++) text += `$${i}${strings[i]}`;
  return { text, params };
}

/** URL de Netlify Database si estamos en Netlify; si no, null. */
async function cloudConnectionString(): Promise<string | null> {
  if (process.env.EOS_FORCE_LOCAL_DB === "1") return null;
  try {
    const { getConnectionString } = await import("@netlify/database");
    return getConnectionString();
  } catch {
    return null;
  }
}

// ---------------- Netlify Database ----------------

async function openCloud(connectionString: string): Promise<Backend> {
  // Node 22+ trae WebSocket global, que usa el Pool para las migraciones.
  const { neon, Pool, types } = await import("@neondatabase/serverless");

  // Mismos formatos que en local: fechas como texto y numéricos como número.
  const custom: Record<number, (v: string) => unknown> = {
    1082: (v) => v, // date
    1114: (v) => v, // timestamp
    1184: (v) => new Date(v).toISOString(), // timestamptz
    1700: (v) => Number(v), // numeric
  };
  const typeConfig = {
    getTypeParser: (oid: number, format?: "text" | "binary") =>
      custom[oid] ?? types.getTypeParser(oid, format ?? "text"),
  };
  const http = neon(connectionString, { types: typeConfig });

  // Migraciones: una sola vez por arranque, con candado para que dos
  // funciones que arrancan a la vez no las apliquen doble.
  const { MIGRATIONS } = await import("./db-migrations.generated");
  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(84210517)");
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${CLOUD_SCHEMA}`);
    await client.query(`SET LOCAL search_path TO ${CLOUD_SCHEMA}`);
    await client.query(
      `CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`
    );
    const applied = new Set((await client.query<{ name: string }>(`SELECT name FROM _migrations`)).rows.map((r) => r.name));
    for (const m of MIGRATIONS) {
      if (applied.has(m.name)) continue;
      await client.query(m.sql);
      await client.query(`INSERT INTO _migrations (name) VALUES ($1)`, [m.name]);
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
    await pool.end().catch(() => {});
  }

  return {
    async query(text, params) {
      // Cada consulta va en una transacción corta que fija el esquema.
      const [, rows] = await http.transaction([
        http.query(`SET LOCAL search_path TO ${CLOUD_SCHEMA}`),
        http.query(text, params as unknown[]),
      ]);
      return rows as Row[];
    },
  };
}

// ---------------- PGlite (local) ----------------

const DATA_DIR = process.env.EOS_DATA_DIR || path.join(process.cwd(), ".data", "pglite");
const MIGRATIONS_DIR = path.join(process.cwd(), "db", "migrations");

async function migrateLocal(pg: PGlite) {
  await pg.exec(
    `CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`
  );
  const applied = new Set((await pg.query<{ name: string }>(`SELECT name FROM _migrations`)).rows.map((r) => r.name));
  const pending = readdirSync(MIGRATIONS_DIR).sort().filter((n) => !applied.has(n));
  for (const name of pending) {
    const file = path.join(MIGRATIONS_DIR, name, "migration.sql");
    await pg.transaction(async (tx) => {
      await tx.exec(readFileSync(file, "utf8"));
      await tx.query(`INSERT INTO _migrations (name) VALUES ($1)`, [name]);
    });
  }
}

const migrationCount = () => readdirSync(MIGRATIONS_DIR).length;

async function openLocal(): Promise<Backend> {
  const { PGlite, types } = await import("@electric-sql/pglite");
  mkdirSync(DATA_DIR, { recursive: true });
  const pg = await PGlite.create(DATA_DIR, {
    parsers: {
      [types.DATE]: (v: string) => v,
      [types.TIMESTAMPTZ]: (v: string) => new Date(v).toISOString(),
      [types.TIMESTAMP]: (v: string) => v,
      [types.NUMERIC]: (v: string) => Number(v),
    },
  });
  await migrateLocal(pg);
  let known = migrationCount();
  let migrating: Promise<void> | undefined;

  return {
    async query(text, params) {
      // En desarrollo la conexión sobrevive a las recargas del código: si se
      // copiaron archivos nuevos con migraciones, se aplican sin reiniciar.
      if (process.env.NODE_ENV !== "production" && migrationCount() !== known) {
        migrating ??= migrateLocal(pg).finally(() => {
          known = migrationCount();
          migrating = undefined;
        });
        await migrating;
      }
      return (await pg.query<Row>(text, params)).rows;
    },
  };
}

// ---------------- Instancia compartida ----------------

const globalForDb = globalThis as unknown as { __eosBackend?: Promise<Backend> };

function backend(): Promise<Backend> {
  globalForDb.__eosBackend ??= (async () => {
    const url = await cloudConnectionString();
    return url ? openCloud(url) : openLocal();
  })().catch((e) => {
    // Si falla al abrir (p. ej. red), se reintenta en la siguiente consulta.
    globalForDb.__eosBackend = undefined;
    throw e;
  });
  return globalForDb.__eosBackend;
}

/** "nube" (Netlify Database) o "local" (PGlite), para el diagnóstico. */
export async function databaseKind(): Promise<"nube" | "local"> {
  return (await cloudConnectionString()) ? "nube" : "local";
}

const database: Db = {
  async sql(strings, ...params) {
    const { text } = toQuery(strings, params);
    return (await backend()).query(text, params);
  },
  async query(text, params) {
    return (await backend()).query(text, params);
  },
};

export function db() {
  return database;
}
