import "server-only";
import { db } from "@/lib/db";
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

export async function listUsers(): Promise<User[]> {
  const rows = await db().sql`SELECT * FROM users ORDER BY name`;
  return rows as User[];
}
