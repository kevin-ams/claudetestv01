import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";

const CONNECTION_ID = "calls-sheet";
export const OAUTH_STATE_COOKIE = "calls_google_state";
export const OAUTH_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/spreadsheets.readonly",
];

export function oauthConfigured() {
  return Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET);
}

export function redirectUri(origin: string) {
  return `${process.env.URL || origin}/llamadas/google/callback`;
}

export function authorizeUrl(origin: string, state: string) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: OAUTH_SCOPES.join(" "),
    access_type: "offline",
    // Fuerza a Google a devolver un refresh token aunque ya se haya autorizado antes.
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

// ---------- Cifrado del refresh token (AES-256-GCM con llave derivada de AUTH_SECRET) ----------

function key() {
  const secret = process.env.AUTH_SECRET || "dev-insecure-secret-change-me";
  return createHash("sha256").update(`google-oauth:${secret}`).digest();
}

function encrypt(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
}

function decrypt(token: string) {
  const [iv, tag, data] = token.split(".").map((p) => Buffer.from(p, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

// ---------- Persistencia ----------

export type GoogleConnection = { googleEmail: string | null; connectedAt: string };

export async function getConnection(): Promise<GoogleConnection | null> {
  const rows = await db().sql`
    SELECT google_email, connected_at FROM google_connections WHERE id = ${CONNECTION_ID}
  `;
  if (!rows[0]) return null;
  return {
    googleEmail: rows[0].google_email,
    connectedAt: new Date(rows[0].connected_at).toISOString(),
  };
}

export async function deleteConnection() {
  await db().sql`DELETE FROM google_connections WHERE id = ${CONNECTION_ID}`;
}

/** Cambia el `code` de Google por tokens y guarda el refresh token. */
export async function completeConnection(code: string, origin: string, userId: number) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      redirect_uri: redirectUri(origin),
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Google rechazó la autorización (${res.status}).`);
  const tokens = await res.json();
  if (!tokens.refresh_token) {
    throw new Error("Google no devolvió un refresh token. Quita el acceso de la app en tu cuenta de Google e inténtalo de nuevo.");
  }

  let email: string | null = null;
  if (tokens.id_token) {
    // El id_token viene directo del endpoint de Google por TLS; solo leemos el correo.
    try {
      const payload = JSON.parse(Buffer.from(tokens.id_token.split(".")[1], "base64url").toString());
      email = payload.email ?? null;
    } catch {}
  }

  await db().sql`
    INSERT INTO google_connections (id, refresh_token_enc, google_email, connected_by)
    VALUES (${CONNECTION_ID}, ${encrypt(tokens.refresh_token)}, ${email}, ${userId})
    ON CONFLICT (id) DO UPDATE SET
      refresh_token_enc = EXCLUDED.refresh_token_enc,
      google_email = EXCLUDED.google_email,
      connected_by = EXCLUDED.connected_by,
      connected_at = NOW()
  `;
}

export class GoogleNotConnectedError extends Error {}

/** Access token de corta duración a partir del refresh token guardado. */
export async function oauthAccessToken(): Promise<string> {
  const rows = await db().sql`
    SELECT refresh_token_enc FROM google_connections WHERE id = ${CONNECTION_ID}
  `;
  if (!rows[0]) throw new GoogleNotConnectedError("Google no está conectado.");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      refresh_token: decrypt(rows[0].refresh_token_enc),
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new GoogleNotConnectedError(
      `La conexión con Google expiró o fue revocada (${res.status}). Vuelve a conectar la cuenta.`
    );
  }
  return (await res.json()).access_token;
}
