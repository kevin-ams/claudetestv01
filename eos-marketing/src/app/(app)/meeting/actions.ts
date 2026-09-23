"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import {
  createMeeting,
  startMeeting,
  setSegment,
  completeMeeting,
  addHeadline,
  rateMeeting,
  getMeeting,
} from "@/lib/domain/meetings";
import { createTodo } from "@/lib/domain/todos";
import { createIssue } from "@/lib/domain/issues";
import { isUserInTeam } from "@/lib/domain/users";
import type { IssueTerm } from "@/lib/domain/types";

export async function startNewMeetingAction() {
  const session = await requireSession();
  const meeting = await createMeeting(session.teamId, session.userId, null);
  await startMeeting(meeting.id);
  redirect(`/meeting/${meeting.id}`);
}

export async function advanceSegmentAction(meetingId: number, segmentKey: string) {
  await requireSession();
  await setSegment(meetingId, segmentKey);
  revalidatePath(`/meeting/${meetingId}`);
}

export async function addHeadlineAction(
  meetingId: number,
  type: "customer" | "employee",
  content: string
) {
  const session = await requireSession();
  if (!content.trim()) return;
  await addHeadline({ meetingId, type, content: content.trim(), createdBy: session.userId });
  revalidatePath(`/meeting/${meetingId}`);
}

export async function rateMeetingAction(meetingId: number, rating: number) {
  const session = await requireSession();
  await rateMeeting(meetingId, session.userId, rating);
  revalidatePath(`/meeting/${meetingId}`);
}

export async function completeMeetingAction(meetingId: number) {
  await requireSession();
  await completeMeeting(meetingId);
  revalidatePath("/meeting");
  redirect("/meeting");
}

export type QuickItemInput = {
  title: string;
  description: string;
  ownerId: number | null;
  dueDate: string | null;
  term?: IssueTerm;
};

async function checkQuickItem(meetingId: number, input: QuickItemInput) {
  const session = await requireSession();
  const meeting = await getMeeting(meetingId);
  if (!meeting || meeting.team_id !== session.teamId) throw new Error("Reunión no encontrada");
  const title = input.title.trim().slice(0, 200);
  if (!title) throw new Error("Falta el título");
  const ownerId =
    input.ownerId !== null && (await isUserInTeam(input.ownerId, session.teamId)) ? input.ownerId : null;
  const dueDate = input.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(input.dueDate) ? input.dueDate : null;
  return { session, title, description: input.description.trim().slice(0, 4000), ownerId, dueDate };
}

/** To-Do creado durante la reunión (queda ligado a ella). */
export async function createMeetingTodoAction(meetingId: number, input: QuickItemInput) {
  const { session, title, description, ownerId, dueDate } = await checkQuickItem(meetingId, input);
  await createTodo({ teamId: session.teamId, title, description, ownerId, dueDate, meetingId });
  revalidatePath(`/meeting/${meetingId}`);
  revalidatePath("/todos");
}

/** Issue levantado durante la reunión; entra al final de la lista IDS. */
export async function createMeetingIssueAction(meetingId: number, input: QuickItemInput) {
  const { session, title, description, ownerId, dueDate } = await checkQuickItem(meetingId, input);
  await createIssue({
    teamId: session.teamId,
    title,
    description,
    raisedBy: session.userId,
    ownerId,
    term: input.term === "long_term" ? "long_term" : "short_term",
    dueDate,
  });
  revalidatePath(`/meeting/${meetingId}`);
  revalidatePath("/issues");
}
