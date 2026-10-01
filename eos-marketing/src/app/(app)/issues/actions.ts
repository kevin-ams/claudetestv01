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

export async function sendIssueToClickUpAction(issueId: number): Promise<SendResult> {
  const session = await requireModule("issues");
  const issue = await getIssue(issueId);
  if (!issue || issue.team_id !== session.teamId) return { ok: false, message: "Issue no encontrado." };
  const result = await sendToClickUp("issue", issue);
  if (result.ok) {
    revalidatePath("/issues");
    revalidatePath("/meeting", "layout");
  }
  return result;
}

export async function moveIssueAction(issueId: number, direction: "up" | "down") {
  const session = await requireModule("issues");
  const issues = await listIssues(session.teamId, "open");
  const idx = issues.findIndex((i) => i.id === issueId);
  if (idx === -1) return;
  const swapWith = direction === "up" ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= issues.length) return;

  const a = issues[idx];
  const b = issues[swapWith];
  await reorderIssue(a.id, b.sort_order);
  await reorderIssue(b.id, a.sort_order);
  revalidatePath("/issues");
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
