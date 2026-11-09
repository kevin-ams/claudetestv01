import "server-only";
import { db } from "@/lib/db";

/**
 * Límite de intentos (ISO 27001 8.5; OWASP ASVS 6.3): por correo, 5 fallos en 15 minutos bloquean 15 minutos;
 * por IP, 30 fallos en 15 minutos. Sirve para contraseña, código de doble factor y pedidos de restablecimiento.
 */
export const WINDOW_MINUTES = 15;
export const MAX_PER_EMAIL = 5;
export const MAX_PER_IP = 30;

export type AttemptKind = "password" | "mfa" | "reset";

export async function isLocked(kind: AttemptKind, email: string, ip: string | null): Promise<boolean> {
  const rows = (await db().sql`
    SELECT
      (count(*) FILTER (WHERE email = ${email.toLowerCase()}))::int AS by_email,
      (count(*) FILTER (WHERE ${ip}::text IS NOT NULL AND ip = ${ip}))::int AS by_ip
    FROM auth_attempts
    WHERE kind = ${kind} AND NOT ok AND created_at > NOW() - make_interval(mins => ${WINDOW_MINUTES})
  `) as { by_email: number; by_ip: number }[];
  const r = rows[0];
  return Number(r?.by_email ?? 0) >= MAX_PER_EMAIL || Number(r?.by_ip ?? 0) >= MAX_PER_IP;
}

/** Registra un intento. Devuelve true si este fallo dejó la cuenta bloqueada (justo al llegar al límite). */
export async function recordAttempt(kind: AttemptKind, email: string, ip: string | null, ok: boolean): Promise<boolean> {
  await db().sql`INSERT INTO auth_attempts (kind, email, ip, ok) VALUES (${kind}, ${email.toLowerCase()}, ${ip}, ${ok})`;
  if (ok) return false;
  const rows = (await db().sql`
    SELECT count(*)::int AS n FROM auth_attempts
    WHERE kind = ${kind} AND email = ${email.toLowerCase()} AND NOT ok AND created_at > NOW() - make_interval(mins => ${WINDOW_MINUTES})
  `) as { n: number }[];
  return Number(rows[0]?.n ?? 0) === MAX_PER_EMAIL;
}

/** Un inicio de sesión correcto limpia los fallos recientes de esa cuenta. */
export async function clearFailures(kind: AttemptKind, email: string) {
  await db().sql`DELETE FROM auth_attempts WHERE kind = ${kind} AND email = ${email.toLowerCase()} AND NOT ok`;
}

export const LOCKED_MESSAGE = `Demasiados intentos. Por seguridad, espera ${WINDOW_MINUTES} minutos e intenta de nuevo.`;
