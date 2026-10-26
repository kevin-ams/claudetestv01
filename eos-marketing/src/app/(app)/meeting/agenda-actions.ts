"use server";

import { revalidatePath } from "next/cache";
import { requireModule } from "@/lib/auth/access";
import { logActivity } from "@/lib/domain/activity";
import { createIssue } from "@/lib/domain/issues";
import {
  appendToAgendaNote,
  createAgendaNote,
  deleteAgendaItem,
  getAgendaItem,
  getAgendaNote,
  linkAgendaIssue,
  setAgendaStatus,
  updateAgendaNote,
} from "@/lib/domain/team-agenda";
import { clickUpLine, isAgendaStatus, type ClickUpWeekTask } from "@/lib/domain/team-agenda-shared";
import { isUserInTeam } from "@/lib/domain/users";
import { clickUpAssignedTasks, ClickUpNotConfiguredError } from "@/lib/integrations/clickup";
import { addDaysISO, shiftWeek } from "@/lib/utils/dates";

type Result = { ok: boolean; message: string };
const ISO = /^\d{4}-\d{2}-\d{2}$/;

const weekOf = (v: string) => (ISO.test(String(v ?? "")) ? shiftWeek(v, 0) : null);
const dateOrNull = (v: unknown) => (ISO.test(String(v ?? "")) ? String(v) : null);
const clean = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

function refresh() {
  revalidatePath("/meeting", "layout");
}

const fail = (e: unknown, fallback: string): Result => {
  console.error("[agenda]", e);
  if (e instanceof Error && (e.name === "AccessDeniedError" || e instanceof ClickUpNotConfiguredError)) return { ok: false, message: e.message };
  return { ok: false, message: fallback };
};

export async function addAgendaItemAction(week: string, input: { note: string; userId: number; dueDate: string | null }): Promise<Result> {
  try {
    const session = await requireModule("meeting");
    const monday = weekOf(week);
    const note = clean(input.note, 5000);
    if (!monday || !note) return { ok: false, message: "Escribe en qué se trabajará esta semana." };
    const userId = Number(input.userId) || session.userId;
    if (!(await isUserInTeam(userId, session.teamId))) return { ok: false, message: "Esa persona no es del equipo." };
    const created = await createAgendaNote(session.teamId, monday, session.userId, { userId, note, dueDate: dateOrNull(input.dueDate) });
    if (!created) return { ok: false, message: "Esa persona ya tiene su agenda de esta semana: edítala." };
    await logActivity(session, "meeting", "Agregó su agenda de la semana", monday);
    refresh();
    return { ok: true, message: "Agenda guardada." };
  } catch (e) {
    return fail(e, "No se pudo guardar.");
  }
}

export async function updateAgendaItemAction(id: number, input: { note: string; userId: number; dueDate: string | null }): Promise<Result> {
  try {
    const session = await requireModule("meeting");
    const note = clean(input.note, 5000);
    if (!note) return { ok: false, message: "La agenda no puede quedar vacía (quítala si ya no aplica)." };
    const userId = Number(input.userId);
    if (!(await isUserInTeam(userId, session.teamId))) return { ok: false, message: "Esa persona no es del equipo." };
    const ok = await updateAgendaNote(session.teamId, id, { note, userId, dueDate: dateOrNull(input.dueDate) });
    if (!ok) return { ok: false, message: "Esa persona ya tiene su agenda de esta semana." };
    refresh();
    return { ok: true, message: "Guardado." };
  } catch (e) {
    return fail(e, "No se pudo guardar.");
  }
}

export async function setAgendaStatusAction(id: number, status: string): Promise<Result> {
  try {
    const session = await requireModule("meeting");
    if (!isAgendaStatus(status)) return { ok: false, message: "Estado inválido." };
    await setAgendaStatus(session.teamId, id, status);
    refresh();
    return { ok: true, message: "" };
  } catch (e) {
    return fail(e, "No se pudo cambiar el semáforo.");
  }
}

export async function deleteAgendaItemAction(id: number): Promise<Result> {
  try {
    const session = await requireModule("meeting");
    await deleteAgendaItem(session.teamId, id);
    refresh();
    return { ok: true, message: "" };
  } catch (e) {
    return fail(e, "No se pudo quitar.");
  }
}

/** Si hay algo que hablar: la actividad pasa a la lista de Issues (IDS) con su responsable. */
export async function agendaToIssueAction(id: number): Promise<Result> {
  try {
    const session = await requireModule("issues");
    const item = await getAgendaItem(session.teamId, id);
    if (!item) return { ok: false, message: "No se encontró la agenda." };
    if (item.issue_id) return { ok: false, message: "Esta agenda ya está en Issues." };
    const firstLine = item.note.split("\n").map((l) => l.replace(/^[•\-*\s]+/, "").trim()).find(Boolean) ?? "";
    const issue = await createIssue({
      teamId: session.teamId,
      title: `Agenda de ${item.user_name}${firstLine ? `: ${firstLine.slice(0, 120)}` : ""}`,
      description: `Agenda del equipo (${item.user_name}) · ${item.status === "off_track" ? "Off track" : "On track"}.\n\n${item.note}`,
      raisedBy: session.userId,
      ownerId: item.user_id,
      term: "short_term",
    });
    await linkAgendaIssue(session.teamId, id, issue.id);
    await logActivity(session, "issues", "Pasó una agenda a Issue", item.user_name);
    refresh();
    revalidatePath("/issues");
    return { ok: true, message: `La agenda de ${item.user_name} se agregó a Issues.` };
  } catch (e) {
    return fail(e, "No se pudo crear el Issue.");
  }
}

// --- Importar desde ClickUp ----------------------------------------------------

export async function clickUpAgendaTasksAction(input: {
  week: string;
  userId: number;
  assigneeId: number;
  listIds: string[];
  includeOverdue: boolean;
}): Promise<Result & { tasks: ClickUpWeekTask[] }> {
  try {
    const session = await requireModule("meeting");
    const monday = weekOf(input.week);
    if (!monday) return { ok: false, message: "Semana inválida.", tasks: [] };
    const assigneeId = Number(input.assigneeId);
    if (!assigneeId) return { ok: false, message: "Elige la persona en ClickUp.", tasks: [] };
    const listIds = (Array.isArray(input.listIds) ? input.listIds : []).map(String).filter((id) => /^\d+$/.test(id)).slice(0, 50);
    const [found, imported] = await Promise.all([
      clickUpAssignedTasks({ assigneeId, listIds, from: monday, to: addDaysISO(monday, 7), includeOverdue: Boolean(input.includeOverdue) }),
      getAgendaNote(session.teamId, monday, Number(input.userId) || session.userId),
    ]);
    const noteText = imported?.note ?? "";
    const seen = new Set<string>();
    const tasks: ClickUpWeekTask[] = [];
    for (const [overdue, list] of [
      [false, found.week],
      [true, found.overdue],
    ] as const) {
      for (const t of list) {
        if (seen.has(t.id)) continue;
        seen.add(t.id);
        tasks.push({ id: t.id, name: t.name, url: t.url, list: t.list, status: t.status, dueDate: t.dueDate, overdue, imported: Boolean(t.url && noteText.includes(t.url)) });
      }
    }
    return {
      ok: true,
      message: tasks.length ? "" : "No hay tareas asignadas a esa persona con fecha en esta semana.",
      tasks,
    };
  } catch (e) {
    return { ...fail(e, "No se pudieron leer las tareas de ClickUp."), tasks: [] };
  }
}

export async function importClickUpAgendaAction(input: {
  week: string;
  userId: number;
  tasks: Pick<ClickUpWeekTask, "id" | "name" | "url" | "list" | "dueDate" | "overdue">[];
}): Promise<Result> {
  try {
    const session = await requireModule("meeting");
    const monday = weekOf(input.week);
    if (!monday) return { ok: false, message: "Semana inválida." };
    const userId = Number(input.userId);
    if (!(await isUserInTeam(userId, session.teamId))) return { ok: false, message: "Esa persona no es del equipo." };
    const tasks = (Array.isArray(input.tasks) ? input.tasks : []).slice(0, 200).filter((t) => /^[\w-]+$/.test(String(t?.id ?? "")) && clean(t.name, 300));
    if (tasks.length === 0) return { ok: false, message: "Elige al menos una tarea." };
    const note = await getAgendaNote(session.teamId, monday, userId);
    const fresh = tasks.filter((t) => !(note?.note ?? "").includes(String(t.url ?? "")) || !t.url);
    if (fresh.length === 0) return { ok: true, message: "Esas tareas ya estaban en la agenda." };
    await appendToAgendaNote(
      session.teamId,
      monday,
      session.userId,
      userId,
      fresh.map((t) =>
        clickUpLine({
          name: clean(t.name, 300),
          url: /^https:\/\//.test(String(t.url ?? "")) ? String(t.url).slice(0, 500) : "",
          list: clean(t.list, 200),
          dueDate: dateOrNull(t.dueDate),
          overdue: Boolean(t.overdue),
        }).trim()
      ),
      // Si se trae algo vencido, la agenda queda en Off track.
      fresh.some((t) => t.overdue)
    );
    await logActivity(session, "meeting", "Importó tareas de ClickUp a la agenda", `${fresh.length} tarea(s), semana ${monday}`);
    refresh();
    const skipped = tasks.length - fresh.length;
    return { ok: true, message: `${fresh.length} tarea(s) agregada(s) a la agenda${skipped ? ` (${skipped} ya estaban)` : ""}.` };
  } catch (e) {
    return fail(e, "No se pudieron importar las tareas.");
  }
}
