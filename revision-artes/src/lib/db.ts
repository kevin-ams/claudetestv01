import { getDatabase } from "@netlify/database";

let cached: ReturnType<typeof getDatabase> | null = null;

// En local se usa DATABASE_URL (Postgres en tu máquina, ver README).
// En Netlify no hace falta: la conexión la entrega la plataforma.
export function db() {
  if (!cached) {
    const connectionString = process.env.DATABASE_URL;
    cached = connectionString ? getDatabase({ connectionString }) : getDatabase();
  }
  return cached;
}
