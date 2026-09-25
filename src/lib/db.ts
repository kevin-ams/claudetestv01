import { getDatabase } from "@netlify/database";

let cached: ReturnType<typeof getDatabase> | null = null;

export function db() {
  if (!cached) {
    cached = getDatabase();
  }
  return cached;
}

/** False when no Netlify Database is available (e.g. plain `npm run dev`). */
export function isDatabaseConfigured() {
  try {
    db();
    return true;
  } catch {
    return false;
  }
}
