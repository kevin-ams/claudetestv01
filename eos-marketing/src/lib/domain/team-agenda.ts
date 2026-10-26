import "server-only";
import { db } from "@/lib/db";
import type { AgendaItem, AgendaStatus } from "./team-agenda-shared";

// Agenda del equipo: una nota por persona y semana (el texto va en `detail`).

const SELECT = `
  SELECT a.id, a.user_id, u.name AS user_name, to_char(a.week_start, 'YYYY-MM-DD') AS week_start, a.detail AS note,
    a.status, to_char(a.due_date, 'YYYY-MM-DD') AS due_date, a.issue_id, a.updated_at
  FROM team_agenda a
  JOIN users u ON u.id = a.user_id`;

/** Notas de la semana (lunes), por persona. */
export async function listAgenda(teamId: number, week: string): Promise<AgendaItem[]> {
  return (await db().query(`${SELECT} WHERE a.team_id = $1 AND a.week_start = $2::date ORDER BY u.name ASC`, [teamId, week])) as AgendaItem[];
}

export async function getAgendaItem(teamId: number, id: number): Promise<AgendaItem | null> {
  const rows = (await db().query(`${SELECT} WHERE a.id = $1 AND a.team_id = $2`, [id, teamId])) as AgendaItem[];
  return rows[0] ?? null;
}

export async function getAgendaNote(teamId: number, week: string, userId: number): Promise<AgendaItem | null> {
  const rows = (await db().query(`${SELECT} WHERE a.team_id = $1 AND a.week_start = $2::date AND a.user_id = $3`, [teamId, week, userId])) as AgendaItem[];
  return rows[0] ?? null;
}

/** Crea la nota de esa persona; devuelve false si ya tenía una esa semana. */
export async function createAgendaNote(
  teamId: number,
  week: string,
  createdBy: number,
  input: { userId: number; note: string; dueDate: string | null }
): Promise<boolean> {
  const rows = (await db().sql`
    INSERT INTO team_agenda (team_id, user_id, week_start, title, detail, due_date, created_by)
    VALUES (${teamId}, ${input.userId}, ${week}::date, '', ${input.note}, ${input.dueDate}::date, ${createdBy})
    ON CONFLICT (team_id, user_id, week_start) DO NOTHING
    RETURNING id
  `) as { id: number }[];
  return rows.length > 0;
}

/** Edita la nota (y a quién pertenece). Devuelve false si esa persona ya tiene otra nota esa semana. */
export async function updateAgendaNote(teamId: number, id: number, input: { note: string; userId: number; dueDate: string | null }): Promise<boolean> {
  const clash = (await db().sql`
    SELECT 1 FROM team_agenda b JOIN team_agenda a ON a.id = ${id}
    WHERE b.team_id = ${teamId} AND b.user_id = ${input.userId} AND b.week_start = a.week_start AND b.id <> a.id
  `) as unknown[];
  if (clash.length) return false;
  await db().sql`
    UPDATE team_agenda SET detail = ${input.note}, user_id = ${input.userId}, due_date = ${input.dueDate}::date, updated_at = NOW()
    WHERE id = ${id} AND team_id = ${teamId}
  `;
  return true;
}

/** Agrega líneas al final de la nota de esa persona (la crea si no existe). */
export async function appendToAgendaNote(
  teamId: number,
  week: string,
  createdBy: number,
  userId: number,
  lines: string[],
  offTrack: boolean
) {
  const text = lines.join("\n");
  await db().sql`
    INSERT INTO team_agenda (team_id, user_id, week_start, title, detail, status, created_by)
    VALUES (${teamId}, ${userId}, ${week}::date, '', ${text}, ${offTrack ? "off_track" : "on_track"}, ${createdBy})
    ON CONFLICT (team_id, user_id, week_start) DO UPDATE SET
      detail = CASE WHEN team_agenda.detail = '' THEN EXCLUDED.detail ELSE team_agenda.detail || E'\\n' || EXCLUDED.detail END,
      status = CASE WHEN ${offTrack} THEN 'off_track' ELSE team_agenda.status END,
      updated_at = NOW()
  `;
}

export async function setAgendaStatus(teamId: number, id: number, status: AgendaStatus) {
  await db().sql`UPDATE team_agenda SET status = ${status}, updated_at = NOW() WHERE id = ${id} AND team_id = ${teamId}`;
}

export async function linkAgendaIssue(teamId: number, id: number, issueId: number) {
  await db().sql`UPDATE team_agenda SET issue_id = ${issueId} WHERE id = ${id} AND team_id = ${teamId}`;
}

export async function deleteAgendaItem(teamId: number, id: number) {
  await db().sql`DELETE FROM team_agenda WHERE id = ${id} AND team_id = ${teamId}`;
}
