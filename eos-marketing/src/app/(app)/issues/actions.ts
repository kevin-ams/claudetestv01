"use server";

import { requireModule } from "@/lib/auth/access";
import { revalidatePath } from "next/cache";
import { labelOf, logActivity } from "@/lib/domain/activity";
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
} from "@/lib/domain/issues";
import { sendToClickUp, type SendResult } from "@/lib/domain/clickup-send";
import { createTodo } from "@/lib/domain/todos";
import type { IssueTerm } from "@/lib/domain/types";

function ownerId(formData: FormData): number | null {
  const raw = formData.get("ownerId");
  if (!raw || raw === "none") return null;
  return Number(raw);
}

export async function createIssueAction(formData: FormData) {
  const session = await requireModule("issues");
  await createIssue({
    teamId: session.teamId,
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    raisedBy: session.userId,
    ownerId: ownerId(formData),
    term: (formData.get("term") as IssueTerm) || "short_term",
    dueDate: (formData.get("dueDate") as string) || null,
  });
  await logActivity(session, "issues", "Creó Issue", String(formData.get("title") ?? "").trim());
  revalidatePath("/issues");
  revalidatePath("/meeting", "layout");
}

export async function setIssueDueDateAction(issueId: number, dueDate: string | null) {
  const session = await requireModule("issues");
  const issue = await getIssue(issueId);
  if (!issue || issue.team_id !== session.teamId) return;
  await setIssueDueDate(issueId, dueDate || null);
  await logActivity(session, "issues", "Cambió fecha de Issue", `${await labelOf("issues", issueId)}: ${dueDate ?? "sin fecha"}`);
  revalidatePath("/issues");
  revalidatePath("/meeting", "layout");
}

export async function sendIssueToClickUpAction(issueId: number, target: { listId: string; assigneeId: number | null }): Promise<SendResult> {
  const session = await requireModule("issues");
  const issue = await getIssue(issueId);
  if (!issue || issue.team_id !== session.teamId) return { ok: false, message: "Issue no encontrado." };
  const result = await sendToClickUp("issue", issue, { listId: String(target?.listId ?? ""), assigneeId: Number(target?.assigneeId) || null });
  if (result.ok) {
    revalidatePath("/issues");
    revalidatePath("/meeting", "layout");
  }
  return result;
}

export async function moveIssueAction(issueId: number, direction: "up" | "down") {
  const session = await requireModule("issues");
  const all = await listIssues(session.teamId, "open");
  const current = all.find((i) => i.id === issueId);
  if (!current) return;
  if (current.top_rank) {
    await moveIssueTop(session.teamId, issueId, direction === "up" ? -1 : 1);
    revalidatePath("/issues");
    revalidatePath("/meeting", "layout");
    return;
  }
  // Fuera del top 3 se reordena solo entre los demás.
  const issues = all.filter((i) => !i.top_rank);
  const idx = issues.findIndex((i) => i.id === issueId);
  if (idx === -1) return;
  const swapWith = direction === "up" ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= issues.length) return;

  const a = issues[idx];
  const b = issues[swapWith];
  await reorderIssue(a.id, b.sort_order);
  await reorderIssue(b.id, a.sort_order);
  revalidatePath("/issues");
  revalidatePath("/meeting", "layout");
}

/** Marca o quita un Issue del Top 3 de la L10. */
export async function toggleIssueTopAction(issueId: number, on: boolean): Promise<{ ok: boolean; message: string }> {
  const session = await requireModule("issues");
  const issue = await getIssue(issueId);
  if (!issue || issue.team_id !== session.teamId) return { ok: false, message: "Issue no encontrado." };
  if (!(await setIssueTop(session.teamId, issueId, on))) {
    return { ok: false, message: "Ya hay 3 issues en el Top 3. Quita uno para agregar otro." };
  }
  await logActivity(session, "issues", on ? "Marcó Issue en el Top 3" : "Quitó Issue del Top 3", issue.title);
  revalidatePath("/issues");
  revalidatePath("/meeting", "layout");
  return { ok: true, message: "" };
}

export async function updateIssueAction(issueId: number, formData: FormData): Promise<{ ok: boolean; message: string }> {
  const session = await requireModule("issues");
  const issue = await getIssue(issueId);
  if (!issue || issue.team_id !== session.teamId) return { ok: false, message: "Issue no encontrado." };
  const title = String(formData.get("title") ?? "").trim().slice(0, 300);
  if (!title) return { ok: false, message: "Escribe el título del issue." };
  const owner = ownerId(formData);
  const due = String(formData.get("dueDate") ?? "");
  await updateIssue(issueId, {
    title,
    description: String(formData.get("description") ?? "").trim().slice(0, 4000),
    ownerId: owner && Number.isInteger(owner) ? owner : null,
    term: formData.get("term") === "long_term" ? "long_term" : "short_term",
    dueDate: /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : null,
  });
  await logActivity(session, "issues", "Editó Issue", title);
  revalidatePath("/issues");
  revalidatePath("/meeting", "layout");
  return { ok: true, message: "Issue actualizado." };
}

export async function solveIssueAction(issueId: number, createFollowUpTodo: string) {
  const session = await requireModule("issues");
  await solveIssue(issueId);
  if (createFollowUpTodo.trim()) {
    await createTodo({
      teamId: session.teamId,
      title: createFollowUpTodo.trim(),
      ownerId: session.userId,
      dueDate: null,
      meetingId: null,
    });
  }
  await logActivity(session, "issues", "Resolvió Issue", await labelOf("issues", issueId));
  revalidatePath("/issues");
  revalidatePath("/todos");
}

export async function reopenIssueAction(issueId: number) {
  const session = await requireModule("issues");
  await reopenIssue(issueId);
  await logActivity(session, "issues", "Reabrió Issue", await labelOf("issues", issueId));
  revalidatePath("/issues");
}

export async function deleteIssueAction(issueId: number) {
  const session = await requireModule("issues");
  const label = await labelOf("issues", issueId);
  await deleteIssue(issueId);
  await logActivity(session, "issues", "Eliminó Issue", label);
  revalidatePath("/issues");
}
