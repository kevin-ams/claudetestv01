import "server-only";
import { gunzipSync, gzipSync } from "node:zlib";
import { db } from "@/lib/db";
import { MIGRATIONS } from "@/lib/db-migrations.generated";

/**
 * Respaldo completo de la base (todas las tablas, todos los equipos) en un
 * archivo .json.gz, y restauración desde ese archivo.
 * Las imágenes de anuncios no van en el respaldo (solo sus datos).
 */

export const BACKUP_FORMAT = "eos-marketing-respaldo";
const SKIP = new Set(["_migrations", "backup_events"]);
const ident = (name: string) => `"${name.replace(/"/g, '""')}"`;

type Backup = {
  format: typeof BACKUP_FORMAT;
  version: 1;
  created_at: string;
  migrations: string[];
  tables: Record<string, Record<string, unknown>[]>;
};

async function dataTables(): Promise<string[]> {
  const rows = (await db().sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `) as { table_name: string }[];
  return rows.map((r) => r.table_name).filter((t) => !SKIP.has(t));
}

async function columnsOf(): Promise<Map<string, { name: string; serial: boolean }[]>> {
  const rows = (await db().sql`
    SELECT table_name, column_name, COALESCE(column_default, '') LIKE 'nextval%' AS serial
    FROM information_schema.columns
    WHERE table_schema = current_schema()
    ORDER BY table_name, ordinal_position
  `) as { table_name: string; column_name: string; serial: boolean }[];
  const map = new Map<string, { name: string; serial: boolean }[]>();
  for (const r of rows) map.set(r.table_name, [...(map.get(r.table_name) ?? []), { name: r.column_name, serial: r.serial }]);
  return map;
}

/** Orden para insertar: primero las tablas de las que dependen otras. */
async function insertOrder(tables: string[]): Promise<string[]> {
  const deps = (await db().sql`
    SELECT child.relname AS child, parent.relname AS parent
    FROM pg_constraint c
    JOIN pg_class child ON child.oid = c.conrelid
    JOIN pg_class parent ON parent.oid = c.confrelid
    JOIN pg_namespace n ON n.oid = child.relnamespace
    WHERE c.contype = 'f' AND n.nspname = current_schema()
  `) as { child: string; parent: string }[];
  const ordered: string[] = [];
  const pending = new Set(tables);
  while (pending.size) {
    const ready = [...pending].filter((t) =>
      deps.every((d) => d.child !== t || d.parent === t || !pending.has(d.parent))
    );
    // Ciclos (no debería haber): se agregan tal cual para no quedar en bucle.
    for (const t of ready.length ? ready : [...pending]) {
      ordered.push(t);
      pending.delete(t);
    }
  }
  return ordered;
}

export async function createBackup(): Promise<{ file: Uint8Array; tables: number; rows: number }> {
  const tables = await dataTables();
  const data: Backup["tables"] = {};
  let rows = 0;
  for (const t of tables) {
    const result = await db().query(`SELECT * FROM ${ident(t)}`, []);
    // Binarios (imágenes antiguas guardadas en la base) no van en el respaldo.
    data[t] = result.map((r) =>
      Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v instanceof Uint8Array ? null : v]))
    );
    rows += result.length;
  }
  const backup: Backup = {
    format: BACKUP_FORMAT,
    version: 1,
    created_at: new Date().toISOString(),
    migrations: MIGRATIONS.map((m) => m.name),
    tables: data,
  };
  return { file: new Uint8Array(gzipSync(JSON.stringify(backup))), tables: tables.length, rows };
}

export function parseBackup(bytes: Uint8Array): Backup {
  let text: string;
  try {
    text = gunzipSync(bytes).toString("utf8");
  } catch {
    text = new TextDecoder().decode(bytes); // también acepta el .json sin comprimir
  }
  let parsed: Backup;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("El archivo no es un respaldo válido (no se pudo leer).");
  }
  if (parsed?.format !== BACKUP_FORMAT || typeof parsed.tables !== "object") {
    throw new Error("El archivo no es un respaldo de EOS Marketing.");
  }
  const known = new Set(MIGRATIONS.map((m) => m.name));
  const newer = (parsed.migrations ?? []).filter((m) => !known.has(m));
  if (newer.length) {
    throw new Error(`El respaldo es de una versión más nueva de la app (${newer.join(", ")}). Actualiza la app antes de restaurar.`);
  }
  return parsed;
}

/** Reemplaza TODOS los datos por los del respaldo, en una sola transacción. */
export async function restoreBackup(backup: Backup): Promise<{ tables: number; rows: number }> {
  const tables = await dataTables();
  const columns = await columnsOf();
  const order = await insertOrder(tables);
  const statements: { text: string; params?: unknown[] }[] = [
    { text: `TRUNCATE ${tables.map(ident).join(", ")} RESTART IDENTITY CASCADE` },
  ];
  let rows = 0;
  for (const t of order) {
    const data = backup.tables[t];
    const cols = columns.get(t) ?? [];
    if (data?.length) {
      // Solo columnas que existen en ambos lados; las nuevas toman su valor por defecto.
      const present = cols.filter((c) => c.name in data[0]).map((c) => ident(c.name)).join(", ");
      statements.push({
        text: `INSERT INTO ${ident(t)} (${present}) SELECT ${present} FROM json_populate_recordset(NULL::${ident(t)}, $1::json)`,
        params: [JSON.stringify(data)],
      });
      rows += data.length;
    }
    for (const c of cols.filter((x) => x.serial)) {
      statements.push({
        text: `SELECT setval(pg_get_serial_sequence('${ident(t)}', '${c.name}'), COALESCE((SELECT MAX(${ident(c.name)}) FROM ${ident(t)}), 0) + 1, false)`,
      });
    }
  }
  await db().batch(statements);
  return { tables: order.length, rows };
}

export async function recordBackupEvent(kind: "download" | "restore", user: { userId: number; name: string }, detail: string) {
  await db().sql`
    INSERT INTO backup_events (kind, user_id, user_name, detail) VALUES (${kind}, ${user.userId}, ${user.name}, ${detail})
  `;
}

export async function lastBackupEvents() {
  const rows = (await db().sql`
    SELECT kind, user_name, detail, created_at FROM backup_events ORDER BY created_at DESC LIMIT 10
  `) as { kind: "download" | "restore"; user_name: string; detail: string; created_at: string }[];
  return rows;
}

/** Días desde el último respaldo descargado (null si nunca). */
export function daysSinceLastBackup(events: { kind: string; created_at: string }[]): number | null {
  const last = events.find((e) => e.kind === "download");
  return last ? Math.floor((Date.now() - new Date(last.created_at).getTime()) / 86400000) : null;
}
