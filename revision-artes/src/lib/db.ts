import "server-only";
import { neon } from "@neondatabase/serverless";
import { getDatabase } from "@netlify/database";

type Row = Record<string, unknown>;
type Sql = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<Row[]>;

let cached: { sql: Sql } | null = null;

/**
 * Conexión a la base de datos.
 * - En local: DATABASE_URL (Postgres en tu máquina, ver README) con `pg`.
 * - En Netlify: Netlify Database por HTTP con el driver de Neon y NETLIFY_DB_URL,
 *   igual que en EOS (la conexión de @netlify/database falla dentro de Next).
 */
export function db(): { sql: Sql } {
  if (!cached) {
    // Netlify primero: un .env.local que viaje en el despliegue no debe ganarle.
    const netlify = process.env.NETLIFY_DB_URL;
    const local = process.env.DATABASE_URL;
    if (netlify) {
      const sql = neon(netlify);
      cached = { sql: (strings, ...values) => sql(strings, ...values) as Promise<Row[]> };
    } else if (local) {
      const { sql } = getDatabase({ connectionString: local });
      cached = { sql: (strings, ...values) => sql(strings, ...values) as unknown as Promise<Row[]> };
    } else {
      throw new Error("No hay base de datos configurada: define DATABASE_URL (local) o despliega en Netlify.");
    }
  }
  return cached;
}
