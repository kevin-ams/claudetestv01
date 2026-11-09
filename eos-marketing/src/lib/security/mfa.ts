import "server-only";
import { randomBytes } from "node:crypto";
import { Secret, TOTP } from "otpauth";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { getOrganization } from "@/lib/domain/teams";
import { decrypt, encrypt, sha256 } from "./crypto";

/**
 * Doble factor opcional (ISO 27001 8.5): códigos TOTP de 6 dígitos (Google Authenticator, Microsoft Authenticator,
 * 1Password…) y 10 códigos de recuperación de un solo uso. El Administrador Premium decide si su organización lo
 * ofrece (Ajustes › Seguridad); cada persona lo activa en su perfil. Quien lo activó lo sigue usando aunque
 * después se apague la opción.
 */

const ISSUER = "EOS Nivel 10";
const PURPOSE = "totp";

export type MfaMode = "off" | "optional";
export const isMfaMode = (v: unknown): v is MfaMode => v === "off" || v === "optional";

const totp = (secretBase32: string, label: string) =>
  new TOTP({ issuer: ISSUER, label, algorithm: "SHA1", digits: 6, period: 30, secret: Secret.fromBase32(secretBase32) });

export async function getMfaMode(teamId: number): Promise<MfaMode> {
  const org = await getOrganization(teamId);
  if (!org) return "off";
  const rows = (await db().sql`SELECT mfa_mode FROM organizations WHERE id = ${org.id}`) as { mfa_mode: string }[];
  return isMfaMode(rows[0]?.mfa_mode) ? rows[0].mfa_mode : "off";
}

export async function setMfaMode(teamId: number, mode: MfaMode) {
  const org = await getOrganization(teamId);
  if (org) await db().sql`UPDATE organizations SET mfa_mode = ${mode} WHERE id = ${org.id}`;
}

export type MfaStatus = { enabled: boolean; enabledAt: string | null; recoveryLeft: number };

export async function mfaStatus(userId: number): Promise<MfaStatus> {
  const rows = (await db().sql`
    SELECT totp_enabled_at, cardinality(totp_recovery_hashes)::int AS left FROM users WHERE id = ${userId}
  `) as { totp_enabled_at: string | null; left: number }[];
  return { enabled: Boolean(rows[0]?.totp_enabled_at), enabledAt: rows[0]?.totp_enabled_at ?? null, recoveryLeft: Number(rows[0]?.left ?? 0) };
}

/** Paso 1: genera un secreto pendiente (aún no activo) y su QR. */
export async function startEnrollment(userId: number, email: string): Promise<{ qrDataUrl: string; manualKey: string }> {
  const secret = new Secret({ size: 20 }).base32;
  await db().sql`UPDATE users SET totp_pending_secret = ${encrypt(secret, PURPOSE)} WHERE id = ${userId}`;
  const uri = totp(secret, email).toString();
  const qrDataUrl = await QRCode.toDataURL(uri, { margin: 1, width: 220, errorCorrectionLevel: "M" });
  return { qrDataUrl, manualKey: secret.replace(/(.{4})/g, "$1 ").trim() };
}

const cleanCode = (code: string) => code.replace(/[\s-]/g, "");

function validTotp(secretBase32: string, code: string): boolean {
  const c = cleanCode(code);
  if (!/^\d{6}$/.test(c)) return false;
  // ±1 periodo (30 s) por diferencias de reloj.
  return totp(secretBase32, "x").validate({ token: c, window: 1 }) !== null;
}

/** Código de recuperación normalizado: 10 caracteres hexadecimales (se aceptan con o sin guion y mayúsculas). */
const normalizeRecovery = (code: string) => code.toLowerCase().replace(/[^0-9a-f]/g, "");

function newRecoveryCodes(): { plain: string[]; hashes: string[] } {
  const raw = Array.from({ length: 10 }, () => randomBytes(5).toString("hex"));
  return { plain: raw.map((s) => `${s.slice(0, 5)}-${s.slice(5)}`), hashes: raw.map((s) => sha256(s)) };
}

/** Paso 2: confirma con un código de la app. Devuelve los códigos de recuperación (se muestran una sola vez). */
export async function confirmEnrollment(userId: number, code: string): Promise<string[] | null> {
  const rows = (await db().sql`SELECT totp_pending_secret FROM users WHERE id = ${userId}`) as { totp_pending_secret: string | null }[];
  const sealed = rows[0]?.totp_pending_secret;
  const secret = sealed ? decrypt(sealed, PURPOSE) : null;
  if (!secret || !validTotp(secret, code)) return null;
  const { plain, hashes } = newRecoveryCodes();
  await db().sql`
    UPDATE users SET totp_secret = ${encrypt(secret, PURPOSE)}, totp_pending_secret = NULL, totp_enabled_at = NOW(),
      totp_recovery_hashes = ${hashes}::text[]
    WHERE id = ${userId}
  `;
  return plain;
}

export async function disableMfa(userId: number) {
  await db().sql`
    UPDATE users SET totp_secret = NULL, totp_pending_secret = NULL, totp_enabled_at = NULL, totp_recovery_hashes = '{}'
    WHERE id = ${userId}
  `;
}

/** Verifica un código de la app o, si no, un código de recuperación (que se consume). */
export async function verifyMfa(userId: number, code: string): Promise<"totp" | "recovery" | null> {
  const rows = (await db().sql`SELECT totp_secret, totp_recovery_hashes FROM users WHERE id = ${userId}`) as {
    totp_secret: string | null;
    totp_recovery_hashes: string[] | null;
  }[];
  const row = rows[0];
  const secret = row?.totp_secret ? decrypt(row.totp_secret, PURPOSE) : null;
  if (!secret) return null;
  if (validTotp(secret, code)) return "totp";
  const normalized = normalizeRecovery(code);
  if (normalized.length !== 10) return null;
  const hash = sha256(normalized);
  const removed = (await db().sql`
    UPDATE users SET totp_recovery_hashes = array_remove(totp_recovery_hashes, ${hash})
    WHERE id = ${userId} AND ${hash} = ANY(totp_recovery_hashes)
    RETURNING id
  `) as { id: number }[];
  return removed.length ? "recovery" : null;
}

/** Solo para pruebas: el código actual de un secreto. */
export function currentCodeForTests(secretBase32: string): string {
  return totp(secretBase32, "x").generate();
}
