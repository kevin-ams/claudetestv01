import "server-only";
import { PGlite, types } from "@electric-sql/pglite";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

// Base de datos Postgres embebida (PGlite), guardada en disco local.
// No requiere servidor ni cuenta en la nube: arranca vacía y aplica
// las migraciones de `db/migrations` la primera vez.
const DATA_DIR = process.env.EOS_DATA_DIR || path.join(process.cwd(), ".data", "pglite");
const MIGRATIONS_DIR = path.join(process.cwd(), "db", "migrations");

type Row = Record<string, unknown>;
type Db = {
  sql: (strings: TemplateStringsArray, ...params: unknown[]) => Promise<Row[]>;
};

const globalForDb = globalThis as unknown as { __eosDb?: Promise<PGlite> };

async function open(): Promise<PGlite> {
  mkdirSync(DATA_DIR, { recursive: true });
  const pg = await PGlite.create(DATA_DIR, {
    parsers: {
      // Mismos formatos que esperan los tipos del dominio.
      [types.DATE]: (v: string) => v,
      [types.TIMESTAMPTZ]: (v: string) => new Date(v).toISOString(),
      [types.TIMESTAMP]: (v: string) => v,
      [types.NUMERIC]: (v: string) => Number(v),
    },
  });
  await migrate(pg);
  return pg;
}

async function migrate(pg: PGlite) {
  await pg.exec(
    `CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`
  );
  const applied = new Set(
    (await pg.query<{ name: string }>(`SELECT name FROM _migrations`)).rows.map((r) => r.name)
  );
  const pending = readdirSync(MIGRATIONS_DIR).sort().filter((n) => !applied.has(n));
  for (const name of pending) {
    const file = path.join(MIGRATIONS_DIR, name, "migration.sql");
    await pg.transaction(async (tx) => {
      await tx.exec(readFileSync(file, "utf8"));
      await tx.query(`INSERT INTO _migrations (name) VALUES ($1)`, [name]);
    });
  }
}

function instance(): Promise<PGlite> {
  if (!globalForDb.__eosDb) {
    globalForDb.__eosDb = open();
  }
  return globalForDb.__eosDb;
}

const database: Db = {
  async sql(strings, ...params) {
    const pg = await instance();
    const res = await pg.sql<Row>(strings, ...params);
    return res.rows;
  },
};

export function db() {
  return database;
}
