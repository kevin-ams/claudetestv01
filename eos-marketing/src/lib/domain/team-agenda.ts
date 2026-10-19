import "server-only";
import { db } from "@/lib/db";
import type { AgendaItem, AgendaStatus } from "./team-agenda-shared";

/** Agenda del equipo de una semana (lunes), por persona. */
export async function listAgenda(teamId: number, week: string): Promise<AgendaItem[]> {
  return (await db().sql`
    SELECT a.id, a.user_id, u.name AS user_name, to_char(a.week_start, 'YYYY-MM-DD') AS week_start, a.title, a.detail,
      a.status, to_char(a.due_date, 'YYYY-MM-DD') AS due_date, a.clickup_task_id, a.clickup_url, a.clickup_list, a.issue_id
    FROM team_agenda a
    JOIN users u ON u.id = a.user_id
    WHERE a.team_id = ${teamId} AND a.week_start = ${week}::date
    ORDER BY u.name ASC, a.due_date ASC NULLS LAST, a.id ASC
  `) as AgendaItem[];
}

export async function getAgendaItem(teamId: number, id: number): Promise<AgendaItem | null> {
  const rows = (await db().sql`
    SELECT a.id, a.user_id, u.name AS user_name, to_char(a.week_start, 'YYYY-MM-DD') AS week_start, a.title, a.detail,
      a.status, to_char(a.due_date, 'YYYY-MM-DD') AS due_date, a.clickup_task_id, a.clickup_url, a.clickup_list, a.issue_id
    FROM team_agenda a JOIN users u ON u.id = a.user_id
    WHERE a.id = ${id} AND a.team_id = ${teamId}
  `) as AgendaItem[];
  return rows[0] ?? null;
}

export type NewAgendaItem = {
  userId: number;
  title: string;
  detail?: string;
  status?: AgendaStatus;
  dueDate?: string | null;
  clickupTaskId?: string | null;
  clickupUrl?: string | null;
  clickupList?: string;
};

/** Agrega actividades; las de ClickUp que ya están en la semana de esa persona no se repiten. Devuelve cuántas se agregaron. */
export async function addAgendaItems(teamId: number, week: string, createdBy: number, items: NewAgendaItem[]): Promise<number> {
  let added = 0;
  for (const it of items) {
    const rows = (await db().sql`
      INSERT INTO team_agenda (team_id, user_id, week_start, title, detail, status, due_date, clickup_task_id, clickup_url, clickup_list, created_by)
      VALUES (${teamId}, ${it.userId}, ${week}::date, ${it.title}, ${it.detail ?? ""}, ${it.status ?? "on_track"}, ${it.dueDate ?? null}::date,
        ${it.clickupTaskId ?? null}, ${it.clickupUrl ?? null}, ${it.clickupList ?? ""}, ${createdBy})
      ON CONFLICT DO NOTHING
      RETURNING id
    `) as { id: number }[];
    added += rows.length;
  }
  return added;
}

export async function updateAgendaItem(teamId: number, id: number, input: { title: string; detail: string; userId: number; dueDate: string | null }) {
  await db().sql`
    UPDATE team_agenda SET title = ${input.title}, detail = ${input.detail}, user_id = ${input.userId}, due_date = ${input.dueDate}::date
    WHERE id = ${id} AND team_id = ${teamId}
  `;
}

export async function setAgendaStatus(teamId: number, id: number, status: AgendaStatus) {
  await db().sql`UPDATE team_agenda SET status = ${status} WHERE id = ${id} AND team_id = ${teamId}`;
}

export async function linkAgendaIssue(teamId: number, id: number, issueId: number) {
  await db().sql`UPDATE team_agenda SET issue_id = ${issueId} WHERE id = ${id} AND team_id = ${teamId}`;
}

export async function deleteAgendaItem(teamId: number, id: number) {
  await db().sql`DELETE FROM team_agenda WHERE id = ${id} AND team_id = ${teamId}`;
}

/** Tareas de ClickUp que ya están en la agenda de la semana (para marcarlas al importar). */
export async function importedClickUpIds(teamId: number, week: string, userId: number): Promise<string[]> {
  const rows = (await db().sql`
    SELECT clickup_task_id FROM team_agenda
    WHERE team_id = ${teamId} AND week_start = ${week}::date AND user_id = ${userId} AND clickup_task_id IS NOT NULL
  `) as { clickup_task_id: string }[];
  return rows.map((r) => r.clickup_task_id);
}
