import "server-only";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";

export type Admin = {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  created_at: string;
};

export type PublicAdmin = Omit<Admin, "password_hash">;

export async function countAdmins(): Promise<number> {
  const rows = await db().sql`SELECT COUNT(*)::int AS count FROM admins`;
  return (rows[0] as { count: number }).count;
}

export async function getAdminByEmail(email: string): Promise<Admin | null> {
  const rows = await db().sql`
    SELECT * FROM admins WHERE email = ${email.toLowerCase().trim()}
  `;
  return (rows[0] as Admin) ?? null;
}

export async function listAdmins(): Promise<PublicAdmin[]> {
  const rows = await db().sql`
    SELECT id, name, email, created_at FROM admins ORDER BY name ASC
  `;
  return rows as PublicAdmin[];
}

export async function createAdmin(input: {
  name: string;
  email: string;
  password: string;
}): Promise<PublicAdmin> {
  const hash = await hashPassword(input.password);
  const rows = await db().sql`
    INSERT INTO admins (name, email, password_hash)
    VALUES (${input.name}, ${input.email.toLowerCase().trim()}, ${hash})
    RETURNING id, name, email, created_at
  `;
  return rows[0] as PublicAdmin;
}

export async function deleteAdmin(id: number) {
  await db().sql`DELETE FROM admins WHERE id = ${id}`;
}
