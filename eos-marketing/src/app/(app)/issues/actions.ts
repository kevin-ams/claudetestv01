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
  sendIssueToTeam,
} from "@/lib/domain/issues";
import { listShareableTeams } from "@/lib/domain/scorecard";
import { getTeam, teamReplyTo } from "@/lib/domain/teams";
import { listTeamMembers } from "@/lib/domain/users";
import { appUrl, emailConfigured, emailLayout, escapeHtml, sendEmail } from "@/lib/email";
import type { TeamOption } from "@/app/(app)/todos/actions";
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

export async function sendIssueToTeamAction(
  issueId: number,
  input: { teamId: number; ownerId: number | null; dueDate: string | null; notify: boolean; move: boolean }
): Promise<{ ok: boolean; message: string }> {
  try {
    const session = await requireModule("issues");
    const issue = await getIssue(issueId);
    if (!issue || issue.team_id !== session.teamId) return { ok: false, message: "Issue no encontrado." };
    const teamId = Number(input?.teamId);
    const target = (await listShareableTeams(session.teamId)).find((t) => t.id === teamId);
    if (!target) return { ok: false, message: "Elige un equipo válido." };
    const owner = (await listTeamMembers(teamId)).find((m) => m.id === Number(input.ownerId)) ?? null;
    const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(String(input.dueDate ?? "")) ? String(input.dueDate) : (issue.due_date?.slice(0, 10) ?? null);

    const copy = await sendIssueToTeam({ issue, toTeamId: teamId, ownerId: owner?.id ?? null, dueDate, userId: session.userId });
    if (!copy) return { ok: false, message: `${target.name} ya tiene este Issue abierto.` };
    await logActivity(session, "issues", input.move ? "Movió Issue a otro equipo" : "Envió Issue a otro equipo", `${issue.title} → ${target.name}`);

    let note = "";
    if (input.notify && owner && !owner.email.endsWith(".local") && emailConfigured()) {
      const from = await getTeam(session.teamId);
      const mail = await sendEmail({
        to: [owner.email],
        replyTo: await teamReplyTo(session.teamId, session.email),
        subject: `Nuevo Issue de ${from?.name ?? "otro equipo"}: ${issue.title}`,
        html: emailLayout({
          title: "Te enviaron un Issue",
          intro: `${escapeHtml(session.name)} (${escapeHtml(from?.name ?? "otro equipo")}) envió un Issue a <b>${escapeHtml(target.name)}</b> con tu nombre como responsable:`,
          body: `<p style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:22px;color:#111827;font-weight:bold;margin:16px 0 4px">${escapeHtml(issue.title)}</p>${
            issue.description ? `<p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:21px;color:#374151;white-space:pre-line;margin:0">${escapeHtml(issue.description)}</p>` : ""
          }${dueDate ? `<p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:21px;color:#374151;margin:8px 0 0">Fecha: <b>${escapeHtml(dueDate)}</b></p>` : ""}`,
          cta: { label: "Ver Issues", url: `${await appUrl()}/issues` },
        }),
      });
      note = mail.ok ? ` Se avisó por correo a ${owner.name}.` : ` (No se pudo avisar por correo: ${mail.message})`;
    }
    if (input.move) await deleteIssue(issue.id);
    revalidatePath("/issues");
    revalidatePath("/meeting", "layout");
    return { ok: true, message: `${input.move ? "Movido" : "Enviado"} a ${target.name}${owner ? ` (responsable: ${owner.name})` : ""}.${note}` };
  } catch (e) {
    console.error("[issues] enviar a equipo", e);
    return { ok: false, message: e instanceof Error && e.name === "AccessDeniedError" ? e.message : "No se pudo enviar el Issue." };
  }
}
