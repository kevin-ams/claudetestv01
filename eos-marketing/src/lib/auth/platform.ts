import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { config } from "@/lib/config/server";

/**
 * Dueño de la plataforma: quien puede asignar el rol "Administrador Premium" y abrir módulos premium a otros roles.
 * 1) Correos en PLATFORM_OWNER_EMAILS (separados por coma), si existe la variable.
 * 2) Si no, las cuentas marcadas con users.is_platform_owner.
 * 3) Si ninguna está marcada, la primera cuenta creada (quien configuró la app).
 */
export const platformOwnerIds = cache(async (): Promise<number[]> => {
  const emails = config.auth.platformOwnerEmails();
  if (emails.length) {
    const rows = (await db().sql`SELECT id FROM users WHERE lower(email) = ANY(${emails}::text[])`) as { id: number }[];
    return rows.map((r) => r.id);
  }
  const flagged = (await db().sql`SELECT id FROM users WHERE is_platform_owner ORDER BY id`) as { id: number }[];
  if (flagged.length) return flagged.map((r) => r.id);
  const first = (await db().sql`SELECT MIN(id)::int AS id FROM users`) as { id: number | null }[];
  return first[0]?.id ? [first[0].id] : [];
});

export async function isPlatformOwner(userId: number): Promise<boolean> {
  return (await platformOwnerIds()).includes(userId);
}

/** Nombre(s) del dueño, para mostrarlo en Ajustes. */
export async function platformOwnerNames(): Promise<string> {
  const ids = await platformOwnerIds();
  if (!ids.length) return "—";
  const rows = (await db().sql`SELECT name FROM users WHERE id = ANY(${ids}::int[]) ORDER BY id`) as { name: string }[];
  return rows.map((r) => r.name).join(", ");
}
