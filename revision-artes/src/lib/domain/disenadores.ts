import "server-only";
import { db } from "@/lib/db";

export type Disenador = { id: number; nombre: string; email: string };

export async function listDisenadores(): Promise<Disenador[]> {
  const rows = await db().sql`SELECT id, nombre, email FROM disenadores ORDER BY nombre ASC`;
  return rows as Disenador[];
}

export async function getDisenadorPorEmail(email: string): Promise<Disenador | null> {
  const rows = await db().sql`SELECT id, nombre, email FROM disenadores WHERE email = ${email.toLowerCase()}`;
  return (rows[0] as Disenador) ?? null;
}

export async function createDisenador(nombre: string, email: string) {
  await db().sql`INSERT INTO disenadores (nombre, email) VALUES (${nombre}, ${email.toLowerCase()})`;
}

export async function deleteDisenador(id: number) {
  await db().sql`DELETE FROM disenadores WHERE id = ${id}`;
}
