import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";

// Tokens del servidor MCP (Conocimiento › Conectar con Claude). Solo se guarda el hash SHA-256.

export type TokenScope = "vault" | "eos";
export type ApiToken = {
  id: number;
  team_id: number;
  user_id: number;
  user_name: string;
  prefix: string;
  label: string;
  scope: TokenScope;
  can_write: boolean;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  use_count: number;
};

/** Peticiones por minuto permitidas por token. */
export const RATE_LIMIT_PER_MINUTE = 120;

export const hashToken = (plain: string) => createHash("sha256").update(plain).digest("hex");

/** Crea un token y devuelve el valor en claro (solo esta vez). */
export async function createApiToken(input: { teamId: number; userId: number; label: string; scope: TokenScope; canWrite: boolean }): Promise<{ id: number; token: string }> {
  const token = `eos_${randomBytes(24).toString("base64url")}`;
  const rows = (await db().sql`
    INSERT INTO api_tokens (team_id, user_id, token_hash, prefix, label, scope, can_write)
    VALUES (${input.teamId}, ${input.userId}, ${hashToken(token)}, ${token.slice(0, 10)}, ${input.label}, ${input.scope}, ${input.canWrite})
    RETURNING id
  `) as { id: number }[];
  return { id: Number(rows[0].id), token };
}

export async function listApiTokens(teamId: number): Promise<ApiToken[]> {
  const rows = (await db().sql`
    SELECT t.id, t.team_id, t.user_id, u.name AS user_name, t.prefix, t.label, t.scope, t.can_write, t.created_at,
      t.last_used_at, t.revoked_at, t.use_count
    FROM api_tokens t JOIN users u ON u.id = t.user_id
    WHERE t.team_id = ${teamId}
    ORDER BY t.revoked_at IS NOT NULL, t.created_at DESC
  `) as ApiToken[];
  return rows.map((r) => ({ ...r, id: Number(r.id), use_count: Number(r.use_count) }));
}

export async function revokeApiToken(teamId: number, id: number, userId: number, isAdmin: boolean): Promise<boolean> {
  const rows = await db().sql`
    UPDATE api_tokens SET revoked_at = NOW()
    WHERE id = ${id} AND team_id = ${teamId} AND revoked_at IS NULL AND (${isAdmin} OR user_id = ${userId})
    RETURNING id
  `;
  return rows.length > 0;
}

export type TokenCheck =
  | { ok: true; token: { id: number; teamId: number; userId: number; scope: TokenScope; canWrite: boolean } }
  | { ok: false; status: 401 | 429; message: string };

/** Verifica el token (no revocado), aplica el límite por minuto y registra el uso. */
export async function verifyApiToken(plain: string): Promise<TokenCheck> {
  if (!/^eos_[A-Za-z0-9_-]{20,64}$/.test(plain)) return { ok: false, status: 401, message: "Token inválido." };
  const hash = hashToken(plain);
  const rows = (await db().sql`
    UPDATE api_tokens SET
      window_count = CASE WHEN window_start > NOW() - INTERVAL '1 minute' THEN window_count + 1 ELSE 1 END,
      window_start = CASE WHEN window_start > NOW() - INTERVAL '1 minute' THEN window_start ELSE NOW() END,
      use_count = use_count + 1, last_used_at = NOW()
    WHERE token_hash = ${hash} AND revoked_at IS NULL
    RETURNING id, team_id, user_id, scope, can_write, window_count, token_hash
  `) as { id: number; team_id: number; user_id: number; scope: TokenScope; can_write: boolean; window_count: number; token_hash: string }[];
  const r = rows[0];
  if (!r || !timingSafeEqual(Buffer.from(r.token_hash), Buffer.from(hash))) return { ok: false, status: 401, message: "Token inválido o revocado." };
  if (Number(r.window_count) > RATE_LIMIT_PER_MINUTE) return { ok: false, status: 429, message: "Demasiadas peticiones; espera un minuto." };
  return { ok: true, token: { id: Number(r.id), teamId: Number(r.team_id), userId: Number(r.user_id), scope: r.scope === "eos" ? "eos" : "vault", canWrite: Boolean(r.can_write) } };
}
