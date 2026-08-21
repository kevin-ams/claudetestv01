import { getDatabase } from "@netlify/database";

let cached: ReturnType<typeof getDatabase> | null = null;

export function db() {
  if (!cached) {
    cached = getDatabase();
  }
  return cached;
}
