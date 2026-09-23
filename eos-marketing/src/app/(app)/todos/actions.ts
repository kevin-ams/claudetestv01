"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
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
  const session = await requireSession();
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
  refresh();
}

export async function updateTodoAction(todoId: number, formData: FormData) {
  const session = await requireSession();
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
  refresh();
}

export async function sendTodoToClickUpAction(todoId: number): Promise<SendResult> {
  const session = await requireSession();
  const todo = await getTodo(todoId);
  if (!todo || todo.team_id !== session.teamId) return { ok: false, message: "To-Do no encontrado." };
  const result = await sendToClickUp("todo", todo);
  if (result.ok) refresh();
  return result;
}

export async function completeTodoAction(todoId: number, done: boolean) {
  await requireSession();
  await completeTodo(todoId, done);
  refresh();
}

export async function deleteTodoAction(todoId: number) {
  await requireSession();
  await deleteTodo(todoId);
  refresh();
}
