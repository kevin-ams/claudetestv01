import "server-only";
import { db } from "@/lib/db";
import type { Issue, IssueStatus, IssueTerm } from "./types";

export async function listIssues(
  teamId: number,
  status: IssueStatus = "open"
): Promise<Issue[]> {
  const rows = (await db().sql`
    SELECT i.*, ft.name AS from_team_name, su.name AS sent_by_name,
      COALESCE((
        SELECT json_agg(json_build_object('team_id', c.team_id, 'team_name', ct.name, 'done', c.status <> 'open') ORDER BY ct.name)
        FROM issues c JOIN teams ct ON ct.id = c.team_id WHERE c.origin_issue_id = i.id
      ), '[]'::json) AS sent_to
    FROM issues i
    LEFT JOIN teams ft ON ft.id = i.from_team_id
    LEFT JOIN users su ON su.id = i.sent_by
    WHERE i.team_id = ${teamId} AND i.status = ${status}
    ORDER BY i.top_rank ASC NULLS LAST, i.sort_order ASC, i.id ASC
  `) as Issue[];
  return rows.map((r) => ({ ...r, sent_to: typeof r.sent_to === "string" ? JSON.parse(r.sent_to) : r.sent_to }));
}

/**
 * Envía una copia del Issue a otro equipo (al final de su lista, con su responsable allá).
 * Devuelve la copia, o null si ese equipo ya tiene abierta una copia de este Issue.
 */
export async function sendIssueToTeam(input: { issue: Issue; toTeamId: number; ownerId: number | null; dueDate: string | null; userId: number }): Promise<Issue | null> {
  const rows = (await db().sql`
    INSERT INTO issues (team_id, title, description, raised_by, owner_id, term, due_date, sort_order, from_team_id, origin_issue_id, sent_by)
    SELECT ${input.toTeamId}, ${input.issue.title}, ${input.issue.description}, ${input.userId}, ${input.ownerId}, ${input.issue.term}, ${input.dueDate},
      (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM issues WHERE team_id = ${input.toTeamId} AND status = 'open'),
      ${input.issue.team_id}, ${input.issue.id}, ${input.userId}
    WHERE NOT EXISTS (
      SELECT 1 FROM issues WHERE origin_issue_id = ${input.issue.id} AND team_id = ${input.toTeamId} AND status = 'open'
    )
    RETURNING *
  `) as Issue[];
  return rows[0] ?? null;
}

export async function createIssue(input: {
  teamId: number;
  title: string;
  description: string;
  raisedBy: number;
  ownerId: number | null;
  term: IssueTerm;
  dueDate?: string | null;
}): Promise<Issue> {
  // Evita duplicados por doble clic o reenvío: el mismo Issue de la misma persona en los últimos 2 minutos.
  const dup = (await db().sql`
    SELECT * FROM issues
    WHERE team_id = ${input.teamId} AND status = 'open' AND raised_by = ${input.raisedBy}
      AND lower(trim(title)) = lower(trim(${input.title})) AND created_at > NOW() - INTERVAL '2 minutes'
    ORDER BY id DESC LIMIT 1
  `) as Issue[];
  if (dup[0]) return dup[0];
  const rows = await db().sql`
    SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM issues WHERE team_id = ${input.teamId} AND status = 'open'
  `;
  const next = (rows[0] as { next: number }).next;
  const inserted = await db().sql`
    INSERT INTO issues (team_id, title, description, raised_by, owner_id, term, due_date, sort_order)
    VALUES (${input.teamId}, ${input.title}, ${input.description}, ${input.raisedBy}, ${input.ownerId}, ${input.term}, ${input.dueDate ?? null}, ${next})
    RETURNING *
  `;
  return inserted[0] as Issue;
}

export async function reorderIssue(issueId: number, sortOrder: number) {
  await db().sql`UPDATE issues SET sort_order = ${sortOrder} WHERE id = ${issueId}`;
}

export async function solveIssue(issueId: number) {
  const issue = await getIssue(issueId);
  await db().sql`
    UPDATE issues SET status = 'solved', solved_at = NOW(), top_rank = NULL WHERE id = ${issueId}
  `;
  if (issue?.top_rank) await compactTop(issue.team_id);
}

/** Datos editables de un Issue. */
export async function updateIssue(
  issueId: number,
  input: { title: string; description: string; ownerId: number | null; term: IssueTerm; dueDate: string | null }
) {
  await db().sql`
    UPDATE issues SET title = ${input.title}, description = ${input.description}, owner_id = ${input.ownerId},
      term = ${input.term}, due_date = ${input.dueDate}
    WHERE id = ${issueId}
  `;
}

/** Renumera el top 3 (1, 2, 3) sin huecos, respetando el orden actual. */
async function compactTop(teamId: number) {
  const top = (await db().sql`
    SELECT id FROM issues WHERE team_id = ${teamId} AND status = 'open' AND top_rank IS NOT NULL ORDER BY top_rank ASC, id ASC
  `) as { id: number }[];
  for (const [i, t] of top.entries()) {
    await db().sql`UPDATE issues SET top_rank = ${i < 3 ? i + 1 : null} WHERE id = ${t.id}`;
  }
}

export const TOP_LIMIT = 3;

/** Marca o quita un Issue del top 3. Devuelve false si ya hay 3 marcados. */
export async function setIssueTop(teamId: number, issueId: number, on: boolean): Promise<boolean> {
  if (!on) {
    await db().sql`UPDATE issues SET top_rank = NULL WHERE id = ${issueId} AND team_id = ${teamId}`;
    await compactTop(teamId);
    return true;
  }
  const rows = (await db().sql`
    SELECT COUNT(*)::int AS n FROM issues WHERE team_id = ${teamId} AND status = 'open' AND top_rank IS NOT NULL AND id <> ${issueId}
  `) as { n: number }[];
  if (rows[0].n >= TOP_LIMIT) return false;
  await db().sql`
    UPDATE issues SET top_rank = ${rows[0].n + 1} WHERE id = ${issueId} AND team_id = ${teamId} AND status = 'open' AND top_rank IS NULL
  `;
  return true;
}

/** Sube o baja un Issue dentro del top 3. */
export async function moveIssueTop(teamId: number, issueId: number, dir: -1 | 1) {
  const top = (await db().sql`
    SELECT id, top_rank FROM issues WHERE team_id = ${teamId} AND status = 'open' AND top_rank IS NOT NULL ORDER BY top_rank ASC
  `) as { id: number; top_rank: number }[];
  const i = top.findIndex((t) => t.id === issueId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= top.length) return;
  await db().sql`UPDATE issues SET top_rank = ${top[j].top_rank} WHERE id = ${top[i].id}`;
  await db().sql`UPDATE issues SET top_rank = ${top[i].top_rank} WHERE id = ${top[j].id}`;
}

export async function reopenIssue(issueId: number) {
  await db().sql`
    UPDATE issues SET status = 'open', solved_at = NULL WHERE id = ${issueId}
  `;
}

export async function setIssueDueDate(issueId: number, dueDate: string | null) {
  await db().sql`UPDATE issues SET due_date = ${dueDate} WHERE id = ${issueId}`;
}

export async function deleteIssue(issueId: number) {
  const issue = await getIssue(issueId);
  await db().sql`DELETE FROM issues WHERE id = ${issueId}`;
  if (issue?.top_rank) await compactTop(issue.team_id);
}

export async function getIssue(issueId: number): Promise<Issue | null> {
  const rows = await db().sql`SELECT * FROM issues WHERE id = ${issueId}`;
  return (rows[0] as Issue) ?? null;
}

export async function countOpenIssues(teamId: number): Promise<number> {
  const rows = await db().sql`
    SELECT COUNT(*)::int AS count FROM issues WHERE team_id = ${teamId} AND status = 'open'
  `;
  return (rows[0] as { count: number }).count;
}
