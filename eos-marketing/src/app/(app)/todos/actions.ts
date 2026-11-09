"use server";

import { z } from "zod";
import { requireModule } from "@/lib/auth/access";
import { revalidatePath } from "next/cache";
import { NOT_FOUND, formObject, parse, safeAction, zId, zOptDate, zOwner, zText, zTitle, type ActionResult } from "@/lib/actions";
import { logActivity } from "@/lib/domain/activity";
import { notifyAssignee } from "@/lib/domain/assignment-email";
import { createTodo, completeTodo, deleteTodo, getTodo, sendTodoToTeam, updateTodo } from "@/lib/domain/todos";
import { sendToClickUp, type SendResult } from "@/lib/domain/clickup-send";
import { listShareableTeams } from "@/lib/domain/scorecard";
import { isUserInTeam, listTeamMembers } from "@/lib/domain/users";
import { emailConfigured } from "@/lib/email";

// Cada acción: permiso → validar (zod) → dominio con el equipo de la sesión (ids de otro equipo no hacen nada).

const todoForm = z.object({ title: zTitle(300), description: zText(5000), ownerId: zOwner, dueDate: zOptDate });

/** Dueños válidos (personas del equipo), sin repetir. */
async function ownerIds(raw: FormDataEntryValue[] | unknown[], teamId: number): Promise<number[]> {
  const ids = [...new Set(raw.map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 50);
  const valid: number[] = [];
  for (const id of ids) if (await isUserInTeam(id, teamId)) valid.push(id);
  return valid;
}

/** Responsable solo si es del equipo (si no, sin responsable). */
async function teamOwner(id: number | null, teamId: number) {
  return id && (await isUserInTeam(id, teamId)) ? id : null;
}

function refresh() {
  revalidatePath("/todos");
  revalidatePath("/meeting", "layout");
}

/** Crea el To-Do; con varios dueños, uno independiente para cada persona. */
export async function createTodoAction(formData: FormData) {
  const session = await requireModule("todos");
  const input = parse(todoForm.omit({ ownerId: true }), formObject(formData));
  const owners = await ownerIds(formData.getAll("ownerId"), session.teamId);
  for (const owner of owners.length ? owners : [null]) {
    await createTodo({ teamId: session.teamId, ...input, ownerId: owner, meetingId: null });
  }
  await logActivity(session, "todos", "Creó To-Do", owners.length > 1 ? `${input.title} (${owners.length} personas)` : input.title);
  refresh();
}

export async function updateTodoAction(todoId: number, formData: FormData) {
  const session = await requireModule("todos");
  const todo = await getTodo(session.teamId, parse(zId, todoId));
  if (!todo) return;
  const input = parse(todoForm, formObject(formData));
  await updateTodo(session.teamId, todo.id, { ...input, ownerId: await teamOwner(input.ownerId, session.teamId) });
  await logActivity(session, "todos", "Editó To-Do", input.title);
  refresh();
}

export async function sendTodoToClickUpAction(todoId: number, target: { listId: string; assigneeId: number | null }): Promise<SendResult> {
  const session = await requireModule("todos");
  const todo = await getTodo(session.teamId, parse(zId, todoId));
  if (!todo) return NOT_FOUND;
  const result = await sendToClickUp("todo", todo, { listId: String(target?.listId ?? ""), assigneeId: Number(target?.assigneeId) || null });
  if (result.ok) {
    await logActivity(session, "todos", "Envió To-Do a ClickUp", todo.title);
    refresh();
  }
  return result;
}

export async function completeTodoAction(todoId: number, done: boolean) {
  const session = await requireModule("todos");
  const todo = await getTodo(session.teamId, parse(zId, todoId));
  if (!todo) return;
  await completeTodo(session.teamId, todo.id, Boolean(done));
  await logActivity(session, "todos", "Marcó To-Do", `${todo.title}: ${done ? "hecho" : "reabierto"}`);
  refresh();
}

export async function deleteTodoAction(todoId: number) {
  const session = await requireModule("todos");
  const todo = await getTodo(session.teamId, parse(zId, todoId));
  if (!todo) return;
  await deleteTodo(session.teamId, todo.id);
  await logActivity(session, "todos", "Eliminó To-Do", todo.title);
  refresh();
}

// --- Enviar To-Dos a otros equipos ------------------------------------------------

export type TeamOption = { id: number; name: string; members: { id: number; name: string; email: string }[] };

/** Equipos a los que se puede enviar un To-Do, con sus personas (para elegir responsable). */
export async function todoTeamOptionsAction(): Promise<{ teams: TeamOption[]; emailEnabled: boolean }> {
  const session = await requireModule("todos");
  const teams = await listShareableTeams(session.teamId);
  const withMembers = await Promise.all(
    teams.map(async (t) => ({ ...t, members: (await listTeamMembers(t.id)).map((m) => ({ id: m.id, name: m.name, email: m.email })) }))
  );
  return { teams: withMembers, emailEnabled: emailConfigured() };
}

const sendForm = z.object({ teamId: zId, ownerId: zOwner, dueDate: zOptDate.catch(null), notify: z.boolean().catch(false), move: z.boolean().catch(false) });

export async function sendTodoToTeamAction(
  todoId: number,
  input: { teamId: number; ownerId: number | null; dueDate: string | null; notify: boolean; move: boolean }
): Promise<ActionResult> {
  return safeAction("todos", "No se pudo enviar el To-Do.", async () => {
    const session = await requireModule("todos");
    const todo = await getTodo(session.teamId, parse(zId, todoId));
    if (!todo) return NOT_FOUND;
    const form = parse(sendForm, input);
    const target = (await listShareableTeams(session.teamId)).find((t) => t.id === form.teamId);
    if (!target) return { ok: false, message: "Elige un equipo válido." };
    const owner = (await listTeamMembers(target.id)).find((m) => m.id === form.ownerId) ?? null;
    const dueDate = form.dueDate ?? todo.due_date?.slice(0, 10) ?? null;

    const copy = await sendTodoToTeam({ todo, toTeamId: target.id, ownerId: owner?.id ?? null, dueDate, userId: session.userId });
    if (!copy) return { ok: false, message: `${target.name} ya tiene este To-Do pendiente.` };
    await logActivity(session, "todos", form.move ? "Movió To-Do a otro equipo" : "Envió To-Do a otro equipo", `${todo.title} → ${target.name}`);
    const note = form.notify
      ? await notifyAssignee({ kind: "todo", sender: session, targetTeamName: target.name, owner, title: todo.title, description: todo.description, dueDate })
      : "";
    if (form.move) await deleteTodo(session.teamId, todo.id);
    refresh();
    return { ok: true, message: `${form.move ? "Movido" : "Enviado"} a ${target.name}${owner ? ` (responsable: ${owner.name})` : ""}.${note}` };
  });
}
