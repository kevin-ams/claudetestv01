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
import { isUserInTeam, listTeamMembers } from "@/lib/domain/users";
import { meetingRecap } from "@/lib/domain/meeting-recap";
import { getTeam } from "@/lib/domain/teams";
import { buildMeetingSummaryPdf } from "@/lib/pdf/meeting-summary";
import { DEFAULT_THEME_COLOR } from "@/lib/theme";
import { appUrl, emailLayout, escapeHtml, parseRecipients, sendEmail } from "@/lib/email";
import type { IssueTerm } from "@/lib/domain/types";
import { attachPendingEvents, createEvent, deleteEvent, reuseEvent, sendEvent, updateEvent } from "@/lib/domain/l10-events";
import { listShareableTeams } from "@/lib/domain/scorecard";
import { weekStartISO } from "@/lib/utils/dates";

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
  // Los eventos pendientes quedan como leídos en esta reunión.
  const finished = await getMeeting(meetingId);
  if (finished && finished.team_id === session.teamId) await attachPendingEvents(session.teamId, meetingId);
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

/**
 * Envía el resumen PDF por correo: a quienes asistieron (o a todo el equipo si no se
 * pasó lista) y, opcionalmente, a otros correos (p. ej. jefatura).
 */
export async function sendMeetingSummaryAction(
  meetingId: number,
  extraRecipients: string
): Promise<{ ok: boolean; message: string }> {
  const session = await requireModule("meeting", "view");
  const recap = await meetingRecap(meetingId, session.teamId);
  if (!recap) return { ok: false, message: "Reunión no encontrada." };
  const extra = parseRecipients(extraRecipients);
  if (extra.invalid) return { ok: false, message: `Correo inválido: ${extra.invalid}` };

  const members = await listTeamMembers(session.teamId);
  const present = new Set(recap.attendance.filter((a) => a.present).map((a) => a.user_id));
  const people = present.size ? members.filter((m) => present.has(m.id)) : members;
  // Los correos provisionales (*.local) no existen: se omiten.
  const to = [...new Set([...people.map((m) => m.email.toLowerCase()), ...extra.emails])].filter((e) => !e.endsWith(".local"));
  if (to.length === 0) return { ok: false, message: "No hay correos válidos a quién enviar." };

  const team = await getTeam(session.teamId);
  const pdf = await buildMeetingSummaryPdf(recap, team?.theme_color ?? DEFAULT_THEME_COLOR);
  const date = (recap.meeting.started_at ?? recap.meeting.created_at).slice(0, 10);
  const base = await appUrl();
  const avg = recap.average !== null ? `${recap.average.toFixed(1)}/10` : "sin calificar";
  const result = await sendEmail({
    to,
    replyTo: session.email,
    subject: `Resumen Reunión L10 · ${recap.teamName} · ${date}`,
    html: emailLayout({
      title: `Resumen de la Reunión L10`,
      intro: `${escapeHtml(session.name)} comparte el resumen de la reunión #${recap.meeting.id} de <b>${escapeHtml(recap.teamName)}</b> (${date}). Va adjunto en PDF.`,
      body: `<ul style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#374151;padding-left:18px">
<li>Calificación: <b>${avg}</b></li>
<li>To-Dos nuevos: <b>${recap.todos.created.length}</b> · pendientes revisados: <b>${recap.todos.pending.length}</b></li>
<li>Issues resueltos: <b>${recap.issues.solved.length}</b> · nuevos: <b>${recap.issues.created.length}</b></li>
<li>Indicadores fuera de meta: <b>${recap.scorecard.offTrack.length}</b></li></ul>`,
      cta: { label: "Abrir EOS Nivel 10", url: `${base}/meeting` },
      color: team?.theme_color,
    }),
    attachments: [{ filename: `resumen-reunion-L10-${recap.meeting.id}_${date}.pdf`, content: pdf }],
  });
  if (result.ok) await logActivity(session, "meeting", "Envió resumen por correo", `Reunión #${meetingId} → ${to.join(", ")}`);
  return result;
}

// --- Eventos para la L10 -------------------------------------------------------

export type EventInput = { title: string; detail: string; eventDate: string | null; weekFrom?: string | null };
export type EventResult = { ok: boolean; message: string };

function cleanEvent(input: EventInput): (EventInput & { weekFrom: string | null }) | null {
  const title = String(input.title ?? "").trim().slice(0, 200);
  if (!title) return null;
  const date = String(input.eventDate ?? "").trim();
  return {
    title,
    detail: String(input.detail ?? "").trim().slice(0, 2000),
    eventDate: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
    weekFrom: weekOf(input.weekFrom),
  };
}

/** Semana de la L10 (lunes) a partir de cualquier fecha; null = la próxima L10. Semanas pasadas cuentan como la próxima. */
function weekOf(v: unknown): string | null {
  const d = String(v ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const monday = weekStartISO(new Date(`${d}T12:00:00`));
  return monday > weekStartISO() ? monday : null;
}

function refreshEvents() {
  revalidatePath("/meeting", "layout");
}

export async function createEventAction(input: EventInput): Promise<EventResult> {
  const session = await requireModule("meeting");
  const e = cleanEvent(input);
  if (!e) return { ok: false, message: "Escribe el título del evento." };
  await createEvent({ teamId: session.teamId, ...e, userId: session.userId });
  await logActivity(session, "meeting", "Agregó evento para la L10", e.title);
  refreshEvents();
  return { ok: true, message: "Evento agregado." };
}

export async function updateEventAction(id: number, input: EventInput): Promise<EventResult> {
  const session = await requireModule("meeting");
  const e = cleanEvent(input);
  if (!e) return { ok: false, message: "Escribe el título del evento." };
  if (!(await updateEvent({ teamId: session.teamId, id, ...e }))) return { ok: false, message: "No se puede editar este evento." };
  await logActivity(session, "meeting", "Editó evento para la L10", e.title);
  refreshEvents();
  return { ok: true, message: "Evento actualizado." };
}

export async function deleteEventAction(id: number): Promise<EventResult> {
  const session = await requireModule("meeting");
  if (!(await deleteEvent(session.teamId, id))) return { ok: false, message: "No se encontró el evento." };
  await logActivity(session, "meeting", "Quitó evento de la L10", `Evento #${id}`);
  refreshEvents();
  return { ok: true, message: "Evento quitado." };
}

/** Envía un evento propio (pendiente o ya leído) a la L10 de otros equipos: la próxima o la de una semana. */
export async function sendEventAction(id: number, teamIds: number[], weekFrom: string | null = null): Promise<EventResult> {
  const session = await requireModule("meeting");
  const allowed = await listShareableTeams(session.teamId);
  const targets = allowed.filter((t) => teamIds.includes(t.id));
  if (targets.length === 0) return { ok: false, message: "Elige al menos un equipo." };
  const week = weekOf(weekFrom);
  const sent = await sendEvent({ teamId: session.teamId, id, toTeamIds: targets.map((t) => t.id), weekFrom: week, userId: session.userId });
  await logActivity(session, "meeting", "Envió evento a otro equipo", `Evento #${id} → ${targets.map((t) => t.name).join(", ")}`);
  refreshEvents();
  return sent > 0
    ? { ok: true, message: `Enviado a la ${week ? `L10 de la semana del ${week}` : "próxima L10"} de ${targets.map((t) => t.name).join(", ")}.` }
    : { ok: false, message: "Esos equipos ya lo tienen pendiente para su L10." };
}

/** Vuelve a usar un evento ya leído (o recibido) en la L10 de este equipo: la próxima o la de una semana. */
export async function reuseEventAction(id: number, weekFrom: string | null = null): Promise<EventResult> {
  const session = await requireModule("meeting");
  const week = weekOf(weekFrom);
  if (!(await reuseEvent({ teamId: session.teamId, id, weekFrom: week, userId: session.userId }))) {
    return { ok: false, message: "No se encontró el evento." };
  }
  await logActivity(session, "meeting", "Reutilizó evento para la L10", `Evento #${id}${week ? ` · semana ${week}` : ""}`);
  refreshEvents();
  return { ok: true, message: week ? `Listo: se leerá en la L10 de la semana del ${week}.` : "Listo: se leerá en la próxima L10." };
}
