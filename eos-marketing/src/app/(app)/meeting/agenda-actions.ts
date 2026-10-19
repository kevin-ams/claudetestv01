"use server";

import { revalidatePath } from "next/cache";
import { requireModule } from "@/lib/auth/access";
import { logActivity } from "@/lib/domain/activity";
import { createIssue } from "@/lib/domain/issues";
import {
  addAgendaItems,
  deleteAgendaItem,
  getAgendaItem,
  importedClickUpIds,
  linkAgendaIssue,
  setAgendaStatus,
  updateAgendaItem,
} from "@/lib/domain/team-agenda";
import { isAgendaStatus, type ClickUpWeekTask } from "@/lib/domain/team-agenda-shared";
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

export async function addAgendaItemAction(week: string, input: { title: string; detail: string; userId: number; dueDate: string | null }): Promise<Result> {
  try {
    const session = await requireModule("meeting");
    const monday = weekOf(week);
    const title = clean(input.title, 300);
    if (!monday || !title) return { ok: false, message: "Escribe en qué se trabajará." };
    const userId = Number(input.userId) || session.userId;
    if (!(await isUserInTeam(userId, session.teamId))) return { ok: false, message: "Esa persona no es del equipo." };
    await addAgendaItems(session.teamId, monday, session.userId, [{ userId, title, detail: clean(input.detail, 2000), dueDate: dateOrNull(input.dueDate) }]);
    await logActivity(session, "meeting", "Agregó a la agenda del equipo", title);
    refresh();
    return { ok: true, message: "Agregado." };
  } catch (e) {
    return fail(e, "No se pudo agregar.");
  }
}

export async function updateAgendaItemAction(id: number, input: { title: string; detail: string; userId: number; dueDate: string | null }): Promise<Result> {
  try {
    const session = await requireModule("meeting");
    const title = clean(input.title, 300);
    if (!title) return { ok: false, message: "Escribe en qué se trabajará." };
    const userId = Number(input.userId);
    if (!(await isUserInTeam(userId, session.teamId))) return { ok: false, message: "Esa persona no es del equipo." };
    await updateAgendaItem(session.teamId, id, { title, detail: clean(input.detail, 2000), userId, dueDate: dateOrNull(input.dueDate) });
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
    if (!item) return { ok: false, message: "No se encontró la actividad." };
    if (item.issue_id) return { ok: false, message: "Esta actividad ya está en Issues." };
    const issue = await createIssue({
      teamId: session.teamId,
      title: item.title,
      description: [
        `Agenda del equipo (${item.user_name}) · ${item.status === "off_track" ? "Off track" : "On track"}.`,
        item.detail,
        item.clickup_url ? `ClickUp: ${item.clickup_url}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      raisedBy: session.userId,
      ownerId: item.user_id,
      term: "short_term",
    });
    await linkAgendaIssue(session.teamId, id, issue.id);
    await logActivity(session, "issues", "Pasó actividad de la agenda a Issue", item.title);
    refresh();
    revalidatePath("/issues");
    return { ok: true, message: `“${item.title}” se agregó a Issues.` };
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
      importedClickUpIds(session.teamId, monday, Number(input.userId) || session.userId),
    ]);
    const done = new Set(imported);
    const seen = new Set<string>();
    const tasks: ClickUpWeekTask[] = [];
    for (const [overdue, list] of [
      [false, found.week],
      [true, found.overdue],
    ] as const) {
      for (const t of list) {
        if (seen.has(t.id)) continue;
        seen.add(t.id);
        tasks.push({ id: t.id, name: t.name, url: t.url, list: t.list, status: t.status, dueDate: t.dueDate, overdue, imported: done.has(t.id) });
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
    const added = await addAgendaItems(
      session.teamId,
      monday,
      session.userId,
      tasks.map((t) => ({
        userId,
        title: clean(t.name, 300),
        dueDate: dateOrNull(t.dueDate),
        // Lo que ya venció en ClickUp entra en rojo.
        status: t.overdue ? "off_track" : "on_track",
        clickupTaskId: String(t.id),
        clickupUrl: /^https:\/\//.test(String(t.url ?? "")) ? String(t.url).slice(0, 500) : null,
        clickupList: clean(t.list, 200),
      }))
    );
    await logActivity(session, "meeting", "Importó tareas de ClickUp a la agenda", `${added} tarea(s), semana ${monday}`);
    refresh();
    const skipped = tasks.length - added;
    return { ok: true, message: `${added} tarea(s) importada(s)${skipped ? ` (${skipped} ya estaban en la agenda)` : ""}.` };
  } catch (e) {
    return fail(e, "No se pudieron importar las tareas.");
  }
}
