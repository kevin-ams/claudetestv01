"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { createTodo, completeTodo, deleteTodo } from "@/lib/domain/todos";

function ownerId(formData: FormData): number | null {
  const raw = formData.get("ownerId");
  if (!raw || raw === "none") return null;
  return Number(raw);
}

export async function createTodoAction(formData: FormData) {
  const session = await requireSession();
  await createTodo({
    teamId: session.teamId,
    title: String(formData.get("title") ?? "").trim(),
    ownerId: ownerId(formData),
    dueDate: (formData.get("dueDate") as string) || null,
    meetingId: null,
  });
  revalidatePath("/todos");
}

export async function completeTodoAction(todoId: number, done: boolean) {
  await requireSession();
  await completeTodo(todoId, done);
  revalidatePath("/todos");
}

export async function deleteTodoAction(todoId: number) {
  await requireSession();
  await deleteTodo(todoId);
  revalidatePath("/todos");
}
