import "server-only";
import { db } from "@/lib/db";
import { getOrganization } from "@/lib/domain/teams";

/**
 * Revisión de accesos (ISO 27001 5.18): quién entra a la organización, con qué rol, cuándo entró por última vez,
 * si usa doble factor y cuántos tokens de Claude tiene activos. Sirve para la revisión periódica de privilegios.
 */
export type AccessRow = {
  user_id: number;
  name: string;
  email: string;
  team_name: string;
  role_name: string | null;
  is_admin: boolean;
  is_premium: boolean;
  last_login_at: string | null;
  mfa: boolean;
  active_tokens: number;
};

export async function accessReview(teamId: number): Promise<AccessRow[]> {
  const org = await getOrganization(teamId);
  const rows = (await db().sql`
    SELECT u.id AS user_id, u.name, u.email, t.name AS team_name, r.name AS role_name,
      COALESCE(r.is_admin, FALSE) AS is_admin, COALESCE(r.is_premium, FALSE) AS is_premium,
      u.last_login_at, (u.totp_enabled_at IS NOT NULL) AS mfa,
      (SELECT count(*)::int FROM api_tokens a WHERE a.user_id = u.id AND a.team_id = t.id AND a.revoked_at IS NULL) AS active_tokens
    FROM team_members tm
    JOIN users u ON u.id = tm.user_id
    JOIN teams t ON t.id = tm.team_id
    LEFT JOIN team_roles r ON r.id = tm.role_id
    WHERE t.organization_id = ${org?.id ?? -1}
    ORDER BY COALESCE(r.is_premium, FALSE) DESC, COALESCE(r.is_admin, FALSE) DESC, u.name, t.name
  `) as AccessRow[];
  return rows;
}
