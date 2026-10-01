"use server";

import { requireModule } from "@/lib/auth/access";
import { revalidatePath } from "next/cache";
import { labelOf, logActivity } from "@/lib/domain/activity";
import { createTodo, completeTodo, deleteTodo, getTodo, updateTodo } from "@/lib/domain/todos";
import { sendToClickUp, type SendResult } from "@/lib/domain/clickup-send";

function ownerId(formData: FormData): number | null {
  const raw = formData.get("ownerId");
  if (!raw || raw === "none") return null;
  return Number(raw);
}

function refresh() {
  revalidatePath("/todos");
  revalidatePath("/meeting", "layout");
}

export async function createTodoAction(formData: FormData) {
  const session = await requireModule("todos");
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  await createTodo({
    teamId: session.teamId,
    title,
    description: String(formData.get("description") ?? "").trim(),
    ownerId: ownerId(formData),
    dueDate: (formData.get("dueDate") as string) || null,
    meetingId: null,
  });
  await logActivity(session, "todos", "Creó To-Do", title);
  refresh();
}

export async function updateTodoAction(todoId: number, formData: FormData) {
  const session = await requireModule("todos");
  const todo = await getTodo(todoId);
  if (!todo || todo.team_id !== session.teamId) return;
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  await updateTodo(todoId, {
    title,
    description: String(formData.get("description") ?? "").trim(),
    ownerId: ownerId(formData),
    dueDate: (formData.get("dueDate") as string) || null,
  });
  await logActivity(session, "todos", "Editó To-Do", title);
  refresh();
}

export async function sendTodoToClickUpAction(todoId: number): Promise<SendResult> {
  const session = await requireModule("todos");
  const todo = await getTodo(todoId);
  if (!todo || todo.team_id !== session.teamId) return { ok: false, message: "To-Do no encontrado." };
  const result = await sendToClickUp("todo", todo);
  if (result.ok) refresh();
  return result;
}

export async function completeTodoAction(todoId: number, done: boolean) {
  const session = await requireModule("todos");
  await completeTodo(todoId, done);
  await logActivity(session, "todos", "Marcó To-Do", `${await labelOf("todos", todoId)}: ${done ? "hecho" : "reabierto"}`);
  refresh();
}

export async function deleteTodoAction(todoId: number) {
  const session = await requireModule("todos");
  const label = await labelOf("todos", todoId);
  await deleteTodo(todoId);
  await logActivity(session, "todos", "Eliminó To-Do", label);
  refresh();
}
