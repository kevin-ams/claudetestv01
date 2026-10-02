import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";

export type TokenPurpose = "reset" | "invite";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** Crea un enlace de un solo uso; en la base solo queda el hash. */
export async function createPasswordToken(userId: number, purpose: TokenPurpose): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const hours = purpose === "invite" ? 24 * 7 : 1;
  await db().sql`
    INSERT INTO password_tokens (user_id, token_hash, purpose, expires_at)
    VALUES (${userId}, ${sha256(token)}, ${purpose}, NOW() + make_interval(hours => ${hours}))
  `;
  return token;
}

/** ¿Ya se pidió un enlace hace menos de un minuto? (evita mandar correos repetidos). */
export async function tokenRequestedRecently(userId: number): Promise<boolean> {
  const rows = await db().sql`
    SELECT 1 FROM password_tokens WHERE user_id = ${userId} AND created_at > NOW() - INTERVAL '60 seconds' LIMIT 1
  `;
  return rows.length > 0;
}

export async function findValidToken(token: string): Promise<{ user_id: number; purpose: TokenPurpose; name: string; email: string } | null> {
  if (!token || token.length > 200) return null;
  const rows = await db().sql`
    SELECT t.user_id, t.purpose, u.name, u.email FROM password_tokens t JOIN users u ON u.id = t.user_id
    WHERE t.token_hash = ${sha256(token)} AND t.used_at IS NULL AND t.expires_at > NOW()
  `;
  return (rows[0] as { user_id: number; purpose: TokenPurpose; name: string; email: string }) ?? null;
}

/** Cambia la contraseña con el enlace y anula los demás enlaces de esa persona. */
export async function resetPasswordWithToken(token: string, password: string): Promise<{ user_id: number; email: string } | null> {
  const valid = await findValidToken(token);
  if (!valid) return null;
  const hash = await hashPassword(password);
  await db().batch([
    { text: `UPDATE users SET password_hash = $1 WHERE id = $2`, params: [hash, valid.user_id] },
    { text: `UPDATE password_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL`, params: [valid.user_id] },
  ]);
  return { user_id: valid.user_id, email: valid.email };
}
