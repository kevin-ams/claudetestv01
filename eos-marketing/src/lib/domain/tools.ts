import "server-only";
import { db } from "@/lib/db";
import type { Tool, ToolAccess, ToolKind } from "./tools-shared";

const SELECT = `
  SELECT t.id, t.team_id, t.name, t.description, t.category, t.kind, t.url, t.icon, t.access, t.active, t.sort_order,
    COALESCE((SELECT json_agg(r.role_id) FROM tool_roles r WHERE r.tool_id = t.id), '[]'::json) AS role_ids,
    COALESCE((SELECT json_agg(u.user_id) FROM tool_users u WHERE u.tool_id = t.id), '[]'::json) AS user_ids
  FROM tools t`;

const parse = (rows: Record<string, unknown>[]): Tool[] =>
  rows.map((r) => ({
    ...(r as Tool),
    role_ids: (typeof r.role_ids === "string" ? JSON.parse(r.role_ids) : r.role_ids) as number[],
    user_ids: (typeof r.user_ids === "string" ? JSON.parse(r.user_ids) : r.user_ids) as number[],
  }));

/** Todas las herramientas del equipo (para administrarlas). */
export async function listTools(teamId: number): Promise<Tool[]> {
  return parse(
    (await db().query(`${SELECT} WHERE t.team_id = $1 ORDER BY t.sort_order ASC, t.id ASC`, [teamId])) as Record<string, unknown>[]
  );
}

/** Las que puede ver una persona: activas y para todo el equipo, su rol o ella. Administradores: todas las activas. */
export async function listVisibleTools(input: { teamId: number; userId: number; roleId: number | null; isAdmin: boolean }): Promise<Tool[]> {
  const rows = (await db().query(
    `${SELECT}
     WHERE t.team_id = $1 AND t.active
       AND ($4::boolean OR t.access = 'all'
         OR EXISTS (SELECT 1 FROM tool_roles r WHERE r.tool_id = t.id AND r.role_id = $3::int)
         OR EXISTS (SELECT 1 FROM tool_users u WHERE u.tool_id = t.id AND u.user_id = $2))
     ORDER BY t.sort_order ASC, t.id ASC`,
    [input.teamId, input.userId, input.roleId, input.isAdmin]
  )) as Record<string, unknown>[];
  return parse(rows);
}

export type ToolInput = {
  name: string;
  description: string;
  category: string;
  kind: ToolKind;
  url: string;
  icon: string;
  access: ToolAccess;
  roleIds: number[];
  userIds: number[];
};

async function setAudience(teamId: number, toolId: number, input: ToolInput) {
  await db().sql`DELETE FROM tool_roles WHERE tool_id = ${toolId}`;
  await db().sql`DELETE FROM tool_users WHERE tool_id = ${toolId}`;
  if (input.access !== "restricted") return;
  // Solo roles y personas del mismo equipo.
  await db().sql`
    INSERT INTO tool_roles (tool_id, role_id)
    SELECT ${toolId}, r.id FROM team_roles r WHERE r.team_id = ${teamId} AND r.id = ANY(${input.roleIds}::int[])
  `;
  await db().sql`
    INSERT INTO tool_users (tool_id, user_id)
    SELECT ${toolId}, tm.user_id FROM team_members tm WHERE tm.team_id = ${teamId} AND tm.user_id = ANY(${input.userIds}::int[])
  `;
}

export async function createTool(teamId: number, input: ToolInput, userId: number) {
  const rows = (await db().sql`
    INSERT INTO tools (team_id, name, description, category, kind, url, icon, access, sort_order, created_by)
    VALUES (${teamId}, ${input.name}, ${input.description}, ${input.category}, ${input.kind}, ${input.url}, ${input.icon}, ${input.access},
      (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM tools WHERE team_id = ${teamId}), ${userId})
    RETURNING id
  `) as { id: number }[];
  await setAudience(teamId, rows[0].id, input);
  return rows[0].id;
}

export async function updateTool(teamId: number, id: number, input: ToolInput) {
  const rows = (await db().sql`
    UPDATE tools SET name = ${input.name}, description = ${input.description}, category = ${input.category}, kind = ${input.kind}, url = ${input.url},
      icon = ${input.icon}, access = ${input.access}, updated_at = NOW()
    WHERE id = ${id} AND team_id = ${teamId}
    RETURNING id
  `) as { id: number }[];
  if (!rows.length) return false;
  await setAudience(teamId, id, input);
  return true;
}

export async function setToolActive(teamId: number, id: number, active: boolean) {
  await db().sql`UPDATE tools SET active = ${active}, updated_at = NOW() WHERE id = ${id} AND team_id = ${teamId}`;
}

export async function deleteTool(teamId: number, id: number) {
  await db().sql`DELETE FROM tools WHERE id = ${id} AND team_id = ${teamId}`;
}

/** Sube o baja una herramienta en el índice. */
export async function moveTool(teamId: number, id: number, dir: -1 | 1) {
  const tools = await listTools(teamId);
  const i = tools.findIndex((t) => t.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= tools.length) return;
  [tools[i], tools[j]] = [tools[j], tools[i]];
  for (const [k, t] of tools.entries()) {
    await db().sql`UPDATE tools SET sort_order = ${k + 1} WHERE id = ${t.id} AND team_id = ${teamId}`;
  }
}
