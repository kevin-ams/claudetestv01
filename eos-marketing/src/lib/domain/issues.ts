import "server-only";
import { db } from "@/lib/db";
import type { Issue, IssueStatus, IssueTerm } from "./types";

export async function listIssues(
  teamId: number,
  status: IssueStatus = "open"
): Promise<Issue[]> {
  const rows = await db().sql`
    SELECT * FROM issues
    WHERE team_id = ${teamId} AND status = ${status}
    ORDER BY sort_order ASC, id ASC
  `;
  return rows as Issue[];
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
  await db().sql`
    UPDATE issues SET status = 'solved', solved_at = NOW() WHERE id = ${issueId}
  `;
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
  await db().sql`DELETE FROM issues WHERE id = ${issueId}`;
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
