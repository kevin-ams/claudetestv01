import "server-only";
import { db } from "@/lib/db";
import type { Todo, TodoStatus } from "./types";
import { asJson } from "@/lib/db-values";

/** Cuántos To-Dos completados se cargan como máximo (los más recientes): la lista crece sin fin. */
export const DONE_TODOS_LIMIT = 150;

export async function listTodos(
  teamId: number,
  status?: TodoStatus,
  doneLimit = DONE_TODOS_LIMIT
): Promise<Todo[]> {
  const rows = (await db().sql`
    SELECT t.*, ft.name AS from_team_name, su.name AS sent_by_name,
      COALESCE((
        SELECT json_agg(json_build_object('team_id', c.team_id, 'team_name', ct.name, 'done', c.status = 'done') ORDER BY ct.name)
        FROM todos c JOIN teams ct ON ct.id = c.team_id WHERE c.origin_todo_id = t.id
      ), '[]'::json) AS sent_to
    FROM todos t
    LEFT JOIN teams ft ON ft.id = t.from_team_id
    LEFT JOIN users su ON su.id = t.sent_by
    WHERE t.team_id = ${teamId} AND (${status ?? null}::text IS NULL OR t.status = ${status ?? null})
      AND (t.status <> 'done' OR t.id IN (
        SELECT d.id FROM todos d WHERE d.team_id = ${teamId} AND d.status = 'done'
        ORDER BY d.done_at DESC NULLS LAST, d.id DESC LIMIT ${doneLimit}
      ))
    ORDER BY t.status ASC, t.due_date ASC NULLS LAST, t.id DESC
  `) as Todo[];
  return rows.map((r) => ({ ...r, sent_to: asJson<Todo["sent_to"]>(r.sent_to, undefined) }));
}

/**
 * Envía una copia del To-Do a otro equipo (con su responsable allá). Devuelve la copia, o
 * null si ese equipo ya tiene pendiente una copia de este To-Do.
 */
export async function sendTodoToTeam(input: {
  todo: Todo;
  toTeamId: number;
  ownerId: number | null;
  dueDate: string | null;
  userId: number;
}): Promise<Todo | null> {
  const rows = (await db().sql`
    INSERT INTO todos (team_id, title, description, owner_id, due_date, from_team_id, origin_todo_id, sent_by)
    SELECT ${input.toTeamId}, ${input.todo.title}, ${input.todo.description}, ${input.ownerId}, ${input.dueDate},
      ${input.todo.team_id}, ${input.todo.id}, ${input.userId}
    WHERE NOT EXISTS (
      SELECT 1 FROM todos WHERE origin_todo_id = ${input.todo.id} AND team_id = ${input.toTeamId} AND status = 'open'
    )
    RETURNING *
  `) as Todo[];
  return rows[0] ?? null;
}

export async function createTodo(input: {
  teamId: number;
  title: string;
  description?: string;
  ownerId: number | null;
  dueDate: string | null;
  meetingId: number | null;
}): Promise<Todo> {
  // Evita duplicados por doble clic o reenvío: el mismo To-Do en el mismo equipo en los últimos 30 segundos.
  const dup = (await db().sql`
    SELECT * FROM todos
    WHERE team_id = ${input.teamId} AND status = 'open' AND lower(trim(title)) = lower(trim(${input.title}))
      AND owner_id IS NOT DISTINCT FROM ${input.ownerId}::int AND created_at > NOW() - INTERVAL '30 seconds'
    ORDER BY id DESC LIMIT 1
  `) as Todo[];
  if (dup[0]) return dup[0];
  const rows = await db().sql`
    INSERT INTO todos (team_id, title, description, owner_id, due_date, meeting_id)
    VALUES (${input.teamId}, ${input.title}, ${input.description ?? ""}, ${input.ownerId}, ${input.dueDate}, ${input.meetingId})
    RETURNING *
  `;
  return rows[0] as Todo;
}

// Las funciones por id reciben el equipo y lo usan en el WHERE (aislamiento entre equipos).

/** To-Do del equipo (null si no existe o es de otro equipo). */
export async function getTodo(teamId: number, todoId: number): Promise<Todo | null> {
  const rows = await db().sql`SELECT * FROM todos WHERE id = ${todoId} AND team_id = ${teamId}`;
  return (rows[0] as Todo) ?? null;
}

export async function updateTodo(
  teamId: number,
  todoId: number,
  input: { title: string; description: string; ownerId: number | null; dueDate: string | null }
): Promise<boolean> {
  const rows = await db().sql`
    UPDATE todos SET
      title = ${input.title},
      description = ${input.description},
      owner_id = ${input.ownerId},
      due_date = ${input.dueDate}
    WHERE id = ${todoId} AND team_id = ${teamId}
    RETURNING id
  `;
  return rows.length > 0;
}

export async function completeTodo(teamId: number, todoId: number, done: boolean): Promise<boolean> {
  const rows = done
    ? await db().sql`UPDATE todos SET status = 'done', done_at = NOW() WHERE id = ${todoId} AND team_id = ${teamId} RETURNING id`
    : await db().sql`UPDATE todos SET status = 'open', done_at = NULL WHERE id = ${todoId} AND team_id = ${teamId} RETURNING id`;
  return rows.length > 0;
}

export async function deleteTodo(teamId: number, todoId: number): Promise<boolean> {
  const rows = await db().sql`DELETE FROM todos WHERE id = ${todoId} AND team_id = ${teamId} RETURNING id`;
  return rows.length > 0;
}

export async function countOpenTodos(teamId: number): Promise<number> {
  const rows = await db().sql`
    SELECT COUNT(*)::int AS count FROM todos WHERE team_id = ${teamId} AND status = 'open'
  `;
  return (rows[0] as { count: number }).count;
}

export async function countOverdueTodos(teamId: number): Promise<number> {
  const rows = await db().sql`
    SELECT COUNT(*)::int AS count FROM todos
    WHERE team_id = ${teamId} AND status = 'open' AND due_date IS NOT NULL AND due_date < CURRENT_DATE
  `;
  return (rows[0] as { count: number }).count;
}

export async function listTodosByMeeting(teamId: number, meetingId: number): Promise<Todo[]> {
  const rows = await db().sql`
    SELECT * FROM todos WHERE meeting_id = ${meetingId} AND team_id = ${teamId} ORDER BY id ASC
  `;
  return rows as Todo[];
}
