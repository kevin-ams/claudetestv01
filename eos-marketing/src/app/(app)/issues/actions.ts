"use server";

import { requireModule } from "@/lib/auth/access";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/domain/activity";
import { z } from "zod";
import { NOT_FOUND, formObject, parse, safeAction, zId, zOptDate, zOwner, zText, zTitle, type ActionResult } from "@/lib/actions";
import { notifyAssignee } from "@/lib/domain/assignment-email";
import {
  listIssues,
  createIssue,
  reorderIssue,
  solveIssue,
  reopenIssue,
  deleteIssue,
  getIssue,
  setIssueDueDate,
  updateIssue,
  setIssueTop,
  moveIssueTop,
  sendIssueToTeam,
} from "@/lib/domain/issues";
import { listShareableTeams } from "@/lib/domain/scorecard";
import { listTeamMembers } from "@/lib/domain/users";
import { emailConfigured } from "@/lib/email";
import type { TeamOption } from "@/app/(app)/todos/actions";
import { sendToClickUp, type SendResult } from "@/lib/domain/clickup-send";
import { createTodo } from "@/lib/domain/todos";

// Cada acción: permiso → validar (zod) → dominio con el equipo de la sesión (ids de otro equipo no hacen nada).

const zTerm = z.enum(["short_term", "long_term"]).catch("short_term");
const issueForm = z.object({ title: zTitle(300), description: zText(4000), ownerId: zOwner, term: zTerm, dueDate: zOptDate });

function refresh(extra?: string) {
  revalidatePath("/issues");
  revalidatePath("/meeting", "layout");
  if (extra) revalidatePath(extra);
}

export async function createIssueAction(formData: FormData) {
  const session = await requireModule("issues");
  const input = parse(issueForm, formObject(formData));
  await createIssue({ teamId: session.teamId, raisedBy: session.userId, ...input });
  await logActivity(session, "issues", "Creó Issue", input.title);
  refresh();
}

export async function setIssueDueDateAction(issueId: number, dueDate: string | null) {
  const session = await requireModule("issues");
  const issue = await getIssue(session.teamId, parse(zId, issueId));
  if (!issue) return;
  const d = parse(zOptDate, dueDate);
  await setIssueDueDate(session.teamId, issue.id, d);
  await logActivity(session, "issues", "Cambió fecha de Issue", `${issue.title}: ${d ?? "sin fecha"}`);
  refresh();
}

export async function sendIssueToClickUpAction(issueId: number, target: { listId: string; assigneeId: number | null }): Promise<SendResult> {
  const session = await requireModule("issues");
  const issue = await getIssue(session.teamId, parse(zId, issueId));
  if (!issue) return NOT_FOUND;
  const result = await sendToClickUp("issue", issue, { listId: String(target?.listId ?? ""), assigneeId: Number(target?.assigneeId) || null });
  if (result.ok) refresh();
  return result;
}

export async function moveIssueAction(issueId: number, direction: "up" | "down") {
  const session = await requireModule("issues");
  const id = parse(zId, issueId);
  const all = await listIssues(session.teamId, "open");
  const current = all.find((i) => i.id === id);
  if (!current) return;
  if (current.top_rank) {
    await moveIssueTop(session.teamId, id, direction === "up" ? -1 : 1);
    refresh();
    return;
  }
  // Fuera del top 3 se reordena solo entre los demás.
  const issues = all.filter((i) => !i.top_rank);
  const idx = issues.findIndex((i) => i.id === id);
  const swapWith = direction === "up" ? idx - 1 : idx + 1;
  if (idx === -1 || swapWith < 0 || swapWith >= issues.length) return;
  const a = issues[idx];
  const b = issues[swapWith];
  await reorderIssue(session.teamId, a.id, b.sort_order);
  await reorderIssue(session.teamId, b.id, a.sort_order);
  refresh();
}

/** Marca o quita un Issue del Top 3 de la L10. */
export async function toggleIssueTopAction(issueId: number, on: boolean): Promise<ActionResult> {
  return safeAction("issues", "No se pudo cambiar el Top 3.", async () => {
    const session = await requireModule("issues");
    const issue = await getIssue(session.teamId, parse(zId, issueId));
    if (!issue) return NOT_FOUND;
    if (!(await setIssueTop(session.teamId, issue.id, Boolean(on)))) {
      return { ok: false, message: "Ya hay 3 issues en el Top 3. Quita uno para agregar otro." };
    }
    await logActivity(session, "issues", on ? "Marcó Issue en el Top 3" : "Quitó Issue del Top 3", issue.title);
    refresh();
    return { ok: true, message: "" };
  });
}

export async function updateIssueAction(issueId: number, formData: FormData): Promise<ActionResult> {
  return safeAction("issues", "No se pudo guardar el Issue.", async () => {
    const session = await requireModule("issues");
    const issue = await getIssue(session.teamId, parse(zId, issueId));
    if (!issue) return NOT_FOUND;
    const input = parse(issueForm, formObject(formData));
    await updateIssue(session.teamId, issue.id, input);
    await logActivity(session, "issues", "Editó Issue", input.title);
    refresh();
    return { ok: true, message: "Issue actualizado." };
  });
}

export async function solveIssueAction(issueId: number, createFollowUpTodo: string) {
  const session = await requireModule("issues");
  const issue = await getIssue(session.teamId, parse(zId, issueId));
  if (!issue) return;
  await solveIssue(session.teamId, issue.id);
  const followUp = parse(zText(300), createFollowUpTodo ?? "");
  if (followUp) {
    await createTodo({ teamId: session.teamId, title: followUp, ownerId: session.userId, dueDate: null, meetingId: null });
  }
  await logActivity(session, "issues", "Resolvió Issue", issue.title);
  refresh("/todos");
}

export async function reopenIssueAction(issueId: number) {
  const session = await requireModule("issues");
  const issue = await getIssue(session.teamId, parse(zId, issueId));
  if (!issue) return;
  await reopenIssue(session.teamId, issue.id);
  await logActivity(session, "issues", "Reabrió Issue", issue.title);
  refresh();
}

export async function deleteIssueAction(issueId: number) {
  const session = await requireModule("issues");
  const issue = await getIssue(session.teamId, parse(zId, issueId));
  if (!issue) return;
  await deleteIssue(session.teamId, issue.id);
  await logActivity(session, "issues", "Eliminó Issue", issue.title);
  refresh();
}

// --- Enviar Issues a otros equipos -------------------------------------------------

/** Equipos a los que se puede enviar un Issue, con sus personas (para elegir responsable). */
export async function issueTeamOptionsAction(): Promise<{ teams: TeamOption[]; emailEnabled: boolean }> {
  const session = await requireModule("issues");
  const teams = await listShareableTeams(session.teamId);
  const withMembers = await Promise.all(
    teams.map(async (t) => ({ ...t, members: (await listTeamMembers(t.id)).map((m) => ({ id: m.id, name: m.name, email: m.email })) }))
  );
  return { teams: withMembers, emailEnabled: emailConfigured() };
}

const sendForm = z.object({ teamId: zId, ownerId: zOwner, dueDate: zOptDate.catch(null), notify: z.boolean().catch(false), move: z.boolean().catch(false) });

export async function sendIssueToTeamAction(
  issueId: number,
  input: { teamId: number; ownerId: number | null; dueDate: string | null; notify: boolean; move: boolean }
): Promise<ActionResult> {
  return safeAction("issues", "No se pudo enviar el Issue.", async () => {
    const session = await requireModule("issues");
    const issue = await getIssue(session.teamId, parse(zId, issueId));
    if (!issue) return NOT_FOUND;
    const form = parse(sendForm, input);
    const target = (await listShareableTeams(session.teamId)).find((t) => t.id === form.teamId);
    if (!target) return { ok: false, message: "Elige un equipo válido." };
    const owner = (await listTeamMembers(target.id)).find((m) => m.id === form.ownerId) ?? null;
    const dueDate = form.dueDate ?? issue.due_date?.slice(0, 10) ?? null;

    const copy = await sendIssueToTeam({ issue, toTeamId: target.id, ownerId: owner?.id ?? null, dueDate, userId: session.userId });
    if (!copy) return { ok: false, message: `${target.name} ya tiene este Issue abierto.` };
    await logActivity(session, "issues", form.move ? "Movió Issue a otro equipo" : "Envió Issue a otro equipo", `${issue.title} → ${target.name}`);
    const note = form.notify
      ? await notifyAssignee({ kind: "issue", sender: session, targetTeamName: target.name, owner, title: issue.title, description: issue.description, dueDate })
      : "";
    if (form.move) await deleteIssue(session.teamId, issue.id);
    refresh();
    return { ok: true, message: `${form.move ? "Movido" : "Enviado"} a ${target.name}${owner ? ` (responsable: ${owner.name})` : ""}.${note}` };
  });
}
