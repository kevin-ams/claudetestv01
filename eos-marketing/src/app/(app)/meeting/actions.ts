"use server";

import { requireModule } from "@/lib/auth/access";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/domain/activity";
import { redirect } from "next/navigation";
import {
  createMeeting,
  startMeeting,
  setSegment,
  completeMeeting,
  addHeadline,
  rateMeeting,
  getMeeting,
  setCascadeNotes,
  setAttendance,
  setMeetingLeader,
  clearRating,
} from "@/lib/domain/meetings";
import { getAccess } from "@/lib/auth/access";
import { createTodo } from "@/lib/domain/todos";
import { createIssue } from "@/lib/domain/issues";
import { isUserInTeam } from "@/lib/domain/users";
import type { IssueTerm } from "@/lib/domain/types";

export async function startNewMeetingAction() {
  const session = await requireModule("meeting");
  const meeting = await createMeeting(session.teamId, session.userId, null);
  await startMeeting(meeting.id);
  // Quien inicia la reunión la dirige y queda presente en la lista de asistencia.
  await setAttendance(meeting.id, session.userId, true);
  await logActivity(session, "meeting", "Inició reunión L10", `Reunión #${meeting.id}`);
  redirect(`/meeting/${meeting.id}`);
}

export async function advanceSegmentAction(meetingId: number, segmentKey: string) {
  await requireModule("meeting");
  await setSegment(meetingId, segmentKey);
  revalidatePath(`/meeting/${meetingId}`);
}

export async function addHeadlineAction(
  meetingId: number,
  type: "customer" | "employee",
  content: string
) {
  const session = await requireModule("meeting");
  if (!content.trim()) return;
  await addHeadline({ meetingId, type, content: content.trim(), createdBy: session.userId });
  revalidatePath(`/meeting/${meetingId}`);
}

export async function rateMeetingAction(meetingId: number, rating: number) {
  const session = await requireModule("meeting", "view");
  await rateMeeting(meetingId, session.userId, rating);
  revalidatePath(`/meeting/${meetingId}`);
}

export async function completeMeetingAction(meetingId: number) {
  const session = await requireModule("meeting");
  await completeMeeting(meetingId);
  await logActivity(session, "meeting", "Finalizó reunión L10", `Reunión #${meetingId}`);
  revalidatePath("/meeting");
  // Queda en la reunión: la pantalla final ofrece descargar el resumen en PDF.
  revalidatePath(`/meeting/${meetingId}`);
  redirect(`/meeting/${meetingId}`);
}

export type QuickItemInput = {
  title: string;
  description: string;
  ownerId: number | null;
  dueDate: string | null;
  term?: IssueTerm;
};

async function checkQuickItem(meetingId: number, input: QuickItemInput) {
  const session = await requireModule("meeting");
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

export async function saveCascadeNotesAction(meetingId: number, notes: string) {
  const session = await requireModule("meeting");
  await setCascadeNotes(meetingId, session.teamId, notes.slice(0, 5000));
  revalidatePath(`/meeting/${meetingId}`);
}

async function teamMeeting(meetingId: number) {
  const session = await requireModule("meeting");
  const meeting = await getMeeting(meetingId);
  if (!meeting || meeting.team_id !== session.teamId) throw new Error("Reunión no encontrada");
  return { session, meeting };
}

/** Marca o desmarca a una persona en la lista de asistencia. */
export async function setAttendanceAction(meetingId: number, userId: number, present: boolean) {
  const { session } = await teamMeeting(meetingId);
  if (!(await isUserInTeam(userId, session.teamId))) throw new Error("Esa persona no es del equipo");
  await setAttendance(meetingId, userId, present);
  revalidatePath(`/meeting/${meetingId}`);
}

export async function setMeetingLeaderAction(meetingId: number, userId: number) {
  const { session, meeting } = await teamMeeting(meetingId);
  const access = await getAccess();
  if (meeting.leader_id !== session.userId && !access?.isAdmin) {
    throw new Error("Solo quien dirige la reunión o un administrador puede cambiar quién la dirige");
  }
  if (!(await isUserInTeam(userId, session.teamId))) throw new Error("Esa persona no es del equipo");
  await setMeetingLeader(meetingId, session.teamId, userId);
  revalidatePath(`/meeting/${meetingId}`);
}

/**
 * Calificación de un asistente, capturada por quien dirige la reunión (o un
 * administrador). `rating` null borra la calificación.
 */
export async function rateAttendeeAction(meetingId: number, userId: number, rating: number | null) {
  const { session, meeting } = await teamMeeting(meetingId);
  const access = await getAccess();
  if (userId !== session.userId && meeting.leader_id !== session.userId && !access?.isAdmin) {
    throw new Error("Solo quien dirige la reunión puede calificar por otras personas");
  }
  if (!(await isUserInTeam(userId, session.teamId))) throw new Error("Esa persona no es del equipo");
  if (rating === null) await clearRating(meetingId, userId);
  else {
    const value = Math.round(rating);
    if (value < 1 || value > 10) throw new Error("La calificación va de 1 a 10");
    await rateMeeting(meetingId, userId, value);
  }
  revalidatePath(`/meeting/${meetingId}`);
}
