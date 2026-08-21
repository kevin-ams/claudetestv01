import "server-only";
import { db } from "@/lib/db";
import type { Todo, TodoStatus } from "./types";

export async function listTodos(
  teamId: number,
  status?: TodoStatus
): Promise<Todo[]> {
  if (status) {
    const rows = await db().sql`
      SELECT * FROM todos WHERE team_id = ${teamId} AND status = ${status}
      ORDER BY due_date ASC NULLS LAST, id DESC
    `;
    return rows as Todo[];
  }
  const rows = await db().sql`
    SELECT * FROM todos WHERE team_id = ${teamId}
    ORDER BY status ASC, due_date ASC NULLS LAST, id DESC
  `;
  return rows as Todo[];
}

export async function createTodo(input: {
  teamId: number;
  title: string;
  ownerId: number | null;
  dueDate: string | null;
  meetingId: number | null;
}): Promise<Todo> {
  const rows = await db().sql`
    INSERT INTO todos (team_id, title, owner_id, due_date, meeting_id)
    VALUES (${input.teamId}, ${input.title}, ${input.ownerId}, ${input.dueDate}, ${input.meetingId})
    RETURNING *
  `;
  return rows[0] as Todo;
}

export async function completeTodo(todoId: number, done: boolean) {
  if (done) {
    await db().sql`UPDATE todos SET status = 'done', done_at = NOW() WHERE id = ${todoId}`;
  } else {
    await db().sql`UPDATE todos SET status = 'open', done_at = NULL WHERE id = ${todoId}`;
  }
}

export async function deleteTodo(todoId: number) {
  await db().sql`DELETE FROM todos WHERE id = ${todoId}`;
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

export async function listTodosByMeeting(meetingId: number): Promise<Todo[]> {
  const rows = await db().sql`
    SELECT * FROM todos WHERE meeting_id = ${meetingId} ORDER BY id ASC
  `;
  return rows as Todo[];
}
