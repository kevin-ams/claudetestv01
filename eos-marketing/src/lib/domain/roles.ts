import "server-only";
import { db } from "@/lib/db";
import { isAccessLevel, MODULES, type Permissions } from "@/lib/auth/modules";

export type TeamRole = {
  id: number;
  team_id: number;
  name: string;
  is_admin: boolean;
  is_system: boolean;
  permissions: Permissions;
  members: number;
};

export const ADMIN_ROLE = "Administrador";
export const USER_ROLE = "Usuario";
const USER_DEFAULT: Permissions = { ajustes: "view" };

function parsePermissions(value: unknown): Permissions {
  const raw = typeof value === "string" ? JSON.parse(value) : (value ?? {});
  const out: Permissions = {};
  for (const m of MODULES) {
    const v = (raw as Record<string, unknown>)[m.key];
    if (isAccessLevel(v)) out[m.key] = v;
  }
  return out;
}

/** Crea los roles Administrador y Usuario del equipo si no existen. */
export async function ensureTeamRoles(teamId: number) {
  await db().sql`
    INSERT INTO team_roles (team_id, name, is_admin, is_system, permissions)
    VALUES (${teamId}, ${ADMIN_ROLE}, TRUE, TRUE, '{}'::jsonb),
           (${teamId}, ${USER_ROLE}, FALSE, TRUE, ${JSON.stringify(USER_DEFAULT)}::jsonb)
    ON CONFLICT (team_id, name) DO NOTHING
  `;
}

export async function roleIdByName(teamId: number, name: string): Promise<number> {
  await ensureTeamRoles(teamId);
  const rows = await db().sql`SELECT id FROM team_roles WHERE team_id = ${teamId} AND name = ${name}`;
  return (rows[0] as { id: number }).id;
}

export async function listRoles(teamId: number): Promise<TeamRole[]> {
  await ensureTeamRoles(teamId);
  const rows = await db().sql`
    SELECT r.*, (SELECT COUNT(*)::int FROM team_members tm WHERE tm.role_id = r.id) AS members
    FROM team_roles r
    WHERE r.team_id = ${teamId}
    ORDER BY r.is_admin DESC, r.is_system DESC, r.name ASC
  `;
  return (rows as (Omit<TeamRole, "permissions"> & { permissions: unknown })[]).map((r) => ({
    ...r,
    permissions: parsePermissions(r.permissions),
  }));
}

export async function getRole(teamId: number, roleId: number): Promise<TeamRole | null> {
  return (await listRoles(teamId)).find((r) => r.id === roleId) ?? null;
}

export async function createRole(teamId: number, name: string, permissions: Permissions) {
  const rows = await db().sql`
    INSERT INTO team_roles (team_id, name, permissions)
    VALUES (${teamId}, ${name}, ${JSON.stringify(parsePermissions(permissions))}::jsonb)
    ON CONFLICT (team_id, name) DO NOTHING
    RETURNING id
  `;
  return (rows[0] as { id: number } | undefined)?.id ?? null;
}

export async function updateRole(teamId: number, roleId: number, input: { name?: string; permissions: Permissions }) {
  await db().sql`
    UPDATE team_roles SET
      name = CASE WHEN is_system THEN name ELSE COALESCE(${input.name ?? null}, name) END,
      permissions = ${JSON.stringify(parsePermissions(input.permissions))}::jsonb
    WHERE id = ${roleId} AND team_id = ${teamId} AND is_admin = FALSE
  `;
}

/** Borra un rol personalizado; sus personas pasan a Usuario. */
export async function deleteRole(teamId: number, roleId: number) {
  const userRole = await roleIdByName(teamId, USER_ROLE);
  await db().sql`UPDATE team_members SET role_id = ${userRole} WHERE team_id = ${teamId} AND role_id = ${roleId}`;
  await db().sql`DELETE FROM team_roles WHERE id = ${roleId} AND team_id = ${teamId} AND is_system = FALSE`;
}

export async function countAdmins(teamId: number): Promise<number> {
  const rows = await db().sql`
    SELECT COUNT(*)::int AS n FROM team_members tm JOIN team_roles r ON r.id = tm.role_id
    WHERE tm.team_id = ${teamId} AND r.is_admin
  `;
  return (rows[0] as { n: number }).n;
}

export async function setMemberRole(teamId: number, userId: number, roleId: number) {
  await db().sql`
    UPDATE team_members SET role_id = ${roleId}
    WHERE team_id = ${teamId} AND user_id = ${userId}
      AND EXISTS (SELECT 1 FROM team_roles WHERE id = ${roleId} AND team_id = ${teamId})
  `;
}
