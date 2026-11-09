import "server-only";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { platformOwnerIds } from "@/lib/auth/platform";
import { emailConfigured, sendEmail, emailLayout, escapeHtml } from "@/lib/email";
import { getOrganization } from "@/lib/domain/teams";

/**
 * Bitácora de seguridad (ISO 27001 8.15 / 8.16): solo agregar, se conserva un año (lo impide la base con un disparador).
 * Nunca guarda contraseñas, códigos ni tokens: solo quién, qué, cuándo y desde qué IP.
 */
export type SecurityEventType =
  | "login_ok"
  | "login_failed"
  | "login_locked"
  | "mfa_failed"
  | "mfa_enabled"
  | "mfa_disabled"
  | "mfa_reset"
  | "mfa_recovery_used"
  | "mfa_mode_changed"
  | "password_changed"
  | "password_reset_requested"
  | "password_reset_done"
  | "role_changed"
  | "member_removed"
  | "access_changed"
  | "token_created"
  | "token_revoked"
  | "backup_downloaded"
  | "backup_restored"
  | "export_downloaded"
  | "ai_settings_changed";

export const EVENT_LABEL: Record<SecurityEventType, string> = {
  login_ok: "Inicio de sesión",
  login_failed: "Contraseña incorrecta",
  login_locked: "Cuenta bloqueada por intentos",
  mfa_failed: "Código de doble factor incorrecto",
  mfa_enabled: "Activó el doble factor",
  mfa_disabled: "Desactivó el doble factor",
  mfa_reset: "Restableció el doble factor de otra persona",
  mfa_recovery_used: "Usó un código de recuperación",
  mfa_mode_changed: "Cambió la opción de doble factor",
  password_changed: "Cambió su contraseña",
  password_reset_requested: "Pidió restablecer la contraseña",
  password_reset_done: "Restableció la contraseña",
  role_changed: "Cambio de rol",
  member_removed: "Quitó a una persona del equipo",
  access_changed: "Cambió el acceso de una persona",
  token_created: "Creó un token de Claude (MCP)",
  token_revoked: "Revocó un token de Claude (MCP)",
  backup_downloaded: "Descargó un respaldo",
  backup_restored: "Restauró un respaldo",
  export_downloaded: "Exportó datos",
  ai_settings_changed: "Cambió los topes del asistente IA",
};

/** IP de quien hace la petición (Netlify la pone en x-nf-client-connection-ip). */
export async function clientIp(): Promise<string | null> {
  try {
    const h = await headers();
    return h.get("x-nf-client-connection-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
  } catch {
    return null;
  }
}

export async function recordSecurityEvent(e: {
  type: SecurityEventType;
  userId?: number | null;
  actorId?: number | null;
  teamId?: number | null;
  email?: string | null;
  detail?: string;
  ip?: string | null;
}): Promise<void> {
  try {
    const org = e.teamId ? await getOrganization(e.teamId) : null;
    const ip = e.ip === undefined ? await clientIp() : e.ip;
    await db().sql`
      INSERT INTO security_events (type, user_id, actor_id, team_id, organization_id, email, ip, detail)
      VALUES (${e.type}, ${e.userId ?? null}, ${e.actorId ?? e.userId ?? null}, ${e.teamId ?? null}, ${org?.id ?? null},
        ${e.email?.toLowerCase() ?? null}, ${ip}, ${(e.detail ?? "").slice(0, 500)})
    `;
  } catch (err) {
    // La bitácora nunca debe tumbar la operación principal.
    console.error("[seguridad] no se pudo registrar el evento", e.type, err);
  }
}

export type SecurityEvent = {
  id: number;
  type: SecurityEventType;
  user_name: string | null;
  actor_name: string | null;
  email: string | null;
  ip: string | null;
  detail: string;
  created_at: string;
};

/** Últimos eventos de la organización (y los de inicio de sesión de sus personas). */
export async function listSecurityEvents(teamId: number, limit = 100): Promise<SecurityEvent[]> {
  const org = await getOrganization(teamId);
  const rows = (await db().sql`
    SELECT e.id, e.type, u.name AS user_name, a.name AS actor_name, e.email, e.ip, e.detail, e.created_at
    FROM security_events e
    LEFT JOIN users u ON u.id = e.user_id
    LEFT JOIN users a ON a.id = e.actor_id
    WHERE e.organization_id = ${org?.id ?? -1}
       OR (e.organization_id IS NULL AND e.user_id IN (
            SELECT tm.user_id FROM team_members tm JOIN teams t ON t.id = tm.team_id WHERE t.organization_id = ${org?.id ?? -1}))
    ORDER BY e.id DESC
    LIMIT ${limit}
  `) as SecurityEvent[];
  return rows;
}

/**
 * Alerta por correo al dueño de la plataforma (ISO 27001 8.16), como máximo una por tipo y persona cada hora.
 * Si no hay correo configurado, queda solo en la bitácora.
 */
export async function alertOwners(type: SecurityEventType, subject: string, text: string, aboutEmail?: string | null) {
  try {
    if (!emailConfigured()) return;
    const recent = await db().sql`
      SELECT 1 FROM security_events
      WHERE type = ${type} AND COALESCE(email, '') = ${aboutEmail?.toLowerCase() ?? ""} AND created_at > NOW() - INTERVAL '1 hour'
      OFFSET 1 LIMIT 1
    `;
    if (recent.length) return; // ya se avisó en la última hora
    const ids = await platformOwnerIds();
    if (!ids.length) return;
    const owners = (await db().sql`SELECT email FROM users WHERE id = ANY(${ids}::int[])`) as { email: string }[];
    const to = owners.map((o) => o.email).filter((e) => !e.endsWith(".local"));
    if (!to.length) return;
    await sendEmail({
      to,
      subject: `Seguridad · ${subject}`,
      html: emailLayout({ title: subject, intro: escapeHtml(text), footer: "Revisa Ajustes › Seguridad para ver la bitácora completa." }),
    });
  } catch (err) {
    console.error("[seguridad] alerta", err);
  }
}
