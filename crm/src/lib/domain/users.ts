import "server-only";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import type { User } from "./types";

// El primer usuario en entrar queda como administrador.
export async function upsertUserFromGoogle(input: {
  googleSub: string | null;
  email: string;
  name: string;
  avatarUrl: string | null;
}): Promise<User> {
  const rows = await db().sql`
    INSERT INTO users (google_sub, email, name, avatar_url, role, last_login_at)
    VALUES (
      ${input.googleSub},
      ${input.email.toLowerCase()},
      ${input.name},
      ${input.avatarUrl},
      CASE WHEN EXISTS (SELECT 1 FROM users) THEN 'member' ELSE 'admin' END,
      NOW()
    )
    ON CONFLICT (email) DO UPDATE SET
      google_sub = COALESCE(EXCLUDED.google_sub, users.google_sub),
      name = EXCLUDED.name,
      avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url),
      last_login_at = NOW()
    RETURNING *
  `;
  return rows[0] as User;
}

export async function countUsers(): Promise<number> {
  const rows = await db().sql`SELECT COUNT(*)::int AS n FROM users`;
  return (rows[0] as { n: number }).n;
}

export async function getUserById(id: number): Promise<User | null> {
  const rows = await db().sql`SELECT * FROM users WHERE id = ${id}`;
  return (rows[0] as User) ?? null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const rows = await db().sql`SELECT * FROM users WHERE email = ${email.toLowerCase()}`;
  return (rows[0] as User) ?? null;
}

export async function listUsers(): Promise<User[]> {
  const rows = await db().sql`SELECT * FROM users ORDER BY active DESC, name`;
  return rows as User[];
}

export async function createPasswordUser(input: {
  name: string;
  email: string;
  password: string;
  role: User["role"];
}): Promise<User> {
  const rows = await db().sql`
    INSERT INTO users (name, email, password_hash, role)
    VALUES (${input.name}, ${input.email.toLowerCase()}, ${await hashPassword(input.password)}, ${input.role})
    RETURNING *
  `;
  return rows[0] as User;
}

export async function setPassword(userId: number, password: string) {
  await db().sql`
    UPDATE users SET password_hash = ${await hashPassword(password)} WHERE id = ${userId}
  `;
}

export async function touchLogin(userId: number) {
  await db().sql`UPDATE users SET last_login_at = NOW() WHERE id = ${userId}`;
}

async function countOtherActiveAdmins(userId: number) {
  const rows = await db().sql`
    SELECT COUNT(*)::int AS n FROM users
    WHERE role = 'admin' AND active AND id <> ${userId}
  `;
  return (rows[0] as { n: number }).n;
}

export async function updateUserAccess(input: {
  userId: number;
  role: User["role"];
  active: boolean;
}) {
  const user = await getUserById(input.userId);
  if (!user) throw new Error("El usuario no existe");
  const losesAdmin = user.role === "admin" && user.active && (input.role !== "admin" || !input.active);
  if (losesAdmin && (await countOtherActiveAdmins(user.id)) === 0) {
    throw new Error("Debe quedar al menos un administrador activo");
  }
  await db().sql`
    UPDATE users SET role = ${input.role}, active = ${input.active} WHERE id = ${input.userId}
  `;
}
