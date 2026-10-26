"use server";

import { requireModule } from "@/lib/auth/access";
import { revalidatePath } from "next/cache";
import { labelOf, logActivity } from "@/lib/domain/activity";
import { createTodo, completeTodo, deleteTodo, getTodo, sendTodoToTeam, updateTodo } from "@/lib/domain/todos";
import { sendToClickUp, type SendResult } from "@/lib/domain/clickup-send";
import { listShareableTeams } from "@/lib/domain/scorecard";
import { getTeam, teamReplyTo } from "@/lib/domain/teams";
import { isUserInTeam, listTeamMembers } from "@/lib/domain/users";
import { appUrl, emailConfigured, emailLayout, escapeHtml, sendEmail } from "@/lib/email";

function ownerId(formData: FormData): number | null {
  const raw = formData.get("ownerId");
  if (!raw || raw === "none") return null;
  return Number(raw);
}

/** Dueños válidos (personas del equipo), sin repetir. */
async function ownerIds(raw: FormDataEntryValue[] | unknown[], teamId: number): Promise<number[]> {
  const ids = [...new Set(raw.map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 50);
  const valid: number[] = [];
  for (const id of ids) if (await isUserInTeam(id, teamId)) valid.push(id);
  return valid;
}

function refresh() {
  revalidatePath("/todos");
  revalidatePath("/meeting", "layout");
}

/** Crea el To-Do; con varios dueños, uno independiente para cada persona. */
export async function createTodoAction(formData: FormData) {
  const session = await requireModule("todos");
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  const owners = await ownerIds(formData.getAll("ownerId"), session.teamId);
  for (const owner of owners.length ? owners : [null]) {
    await createTodo({
      teamId: session.teamId,
      title,
      description: String(formData.get("description") ?? "").trim(),
      ownerId: owner,
      dueDate: (formData.get("dueDate") as string) || null,
      meetingId: null,
    });
  }
  await logActivity(session, "todos", "Creó To-Do", owners.length > 1 ? `${title} (${owners.length} personas)` : title);
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

export async function sendTodoToClickUpAction(todoId: number, target: { listId: string; assigneeId: number | null }): Promise<SendResult> {
  const session = await requireModule("todos");
  const todo = await getTodo(todoId);
  if (!todo || todo.team_id !== session.teamId) return { ok: false, message: "To-Do no encontrado." };
  const result = await sendToClickUp("todo", todo, { listId: String(target?.listId ?? ""), assigneeId: Number(target?.assigneeId) || null });
  if (result.ok) {
    await logActivity(session, "todos", "Envió To-Do a ClickUp", todo.title);
    refresh();
  }
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

// --- Enviar To-Dos a otros equipos ------------------------------------------------

export type TeamOption = { id: number; name: string; members: { id: number; name: string; email: string }[] };

/** Equipos a los que se puede enviar un To-Do, con sus personas (para elegir responsable). */
export async function todoTeamOptionsAction(): Promise<{ teams: TeamOption[]; emailEnabled: boolean }> {
  const session = await requireModule("todos");
  const teams = await listShareableTeams(session.teamId);
  const withMembers = await Promise.all(
    teams.map(async (t) => ({
      ...t,
      members: (await listTeamMembers(t.id)).map((m) => ({ id: m.id, name: m.name, email: m.email })),
    }))
  );
  return { teams: withMembers, emailEnabled: emailConfigured() };
}

export async function sendTodoToTeamAction(
  todoId: number,
  input: { teamId: number; ownerId: number | null; dueDate: string | null; notify: boolean; move: boolean }
): Promise<SendResult> {
  try {
    const session = await requireModule("todos");
    const todo = await getTodo(todoId);
    if (!todo || todo.team_id !== session.teamId) return { ok: false, message: "To-Do no encontrado." };
    const teamId = Number(input?.teamId);
    const allowed = await listShareableTeams(session.teamId);
    const target = allowed.find((t) => t.id === teamId);
    if (!target) return { ok: false, message: "Elige un equipo válido." };
    const members = await listTeamMembers(teamId);
    const owner = members.find((m) => m.id === Number(input.ownerId)) ?? null;
    const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(String(input.dueDate ?? "")) ? String(input.dueDate) : todo.due_date?.slice(0, 10) ?? null;

    const copy = await sendTodoToTeam({ todo, toTeamId: teamId, ownerId: owner?.id ?? null, dueDate, userId: session.userId });
    if (!copy) return { ok: false, message: `${target.name} ya tiene este To-Do pendiente.` };
    await logActivity(session, "todos", input.move ? "Movió To-Do a otro equipo" : "Envió To-Do a otro equipo", `${todo.title} → ${target.name}`);

    let note = "";
    if (input.notify && owner && !owner.email.endsWith(".local") && emailConfigured()) {
      const from = await getTeam(session.teamId);
      const mail = await sendEmail({
        to: [owner.email],
        replyTo: await teamReplyTo(session.teamId, session.email),
        subject: `Nuevo To-Do de ${from?.name ?? "otro equipo"}: ${todo.title}`,
        html: emailLayout({
          title: "Te asignaron un To-Do",
          intro: `${escapeHtml(session.name)} (${escapeHtml(from?.name ?? "otro equipo")}) te envió un To-Do en <b>${escapeHtml(target.name)}</b>:`,
          body: `<p style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:22px;color:#111827;font-weight:bold;margin:16px 0 4px">${escapeHtml(todo.title)}</p>${
            todo.description ? `<p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:21px;color:#374151;white-space:pre-line;margin:0">${escapeHtml(todo.description)}</p>` : ""
          }${dueDate ? `<p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:21px;color:#374151;margin:8px 0 0">Fecha límite: <b>${escapeHtml(dueDate)}</b></p>` : ""}`,
          cta: { label: "Ver To-Dos", url: `${await appUrl()}/todos` },
        }),
      });
      note = mail.ok ? ` Se avisó por correo a ${owner.name}.` : ` (No se pudo avisar por correo: ${mail.message})`;
    }
    if (input.move) await deleteTodo(todo.id);
    refresh();
    return {
      ok: true,
      message: `${input.move ? "Movido" : "Enviado"} a ${target.name}${owner ? ` (responsable: ${owner.name})` : ""}.${note}`,
    };
  } catch (e) {
    console.error("[todos] enviar a equipo", e);
    return { ok: false, message: e instanceof Error && e.name === "AccessDeniedError" ? e.message : "No se pudo enviar el To-Do." };
  }
}
