import "server-only";

/**
 * Integración con ClickUp (API v2) para enviar To-Dos e Issues como tareas.
 *
 * Al enviar se elige la lista (del espacio de ClickUp configurado, por defecto "Marketing")
 * y la persona a quien se asigna. Variables:
 *   CLICKUP_API_TOKEN  token personal (ClickUp › Settings › Apps › API Token), secreto.
 *   CLICKUP_SPACE_NAME nombre del espacio (opcional, por defecto "Marketing"), o
 *   CLICKUP_SPACE_ID   id del espacio (opcional, tiene prioridad).
 */

export type ClickUpTaskInput = {
  listId: string;
  name: string;
  description: string;
  dueDate: string | null; // yyyy-mm-dd
  assigneeId: number | null;
};

export type ClickUpTaskResult = { id: string; url: string };
export type ClickUpList = { id: string; name: string; folder: string };
export type ClickUpMember = { id: number; name: string; email: string };
export type ClickUpOptions = { space: string; lists: ClickUpList[]; members: ClickUpMember[] };

export class ClickUpNotConfiguredError extends Error {
  constructor() {
    super("La conexión con ClickUp no está configurada (falta CLICKUP_API_TOKEN en Netlify). La tarea queda guardada aquí.");
  }
}

export function isClickUpConfigured(): boolean {
  return Boolean(process.env.CLICKUP_API_TOKEN);
}

const BASE = () => (process.env.CLICKUP_API_URL || "https://api.clickup.com/api/v2").replace(/\/$/, "");

async function cu<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  if (!isClickUpConfigured()) throw new ClickUpNotConfiguredError();
  const res = await fetch(`${BASE()}/${path}`, {
    method: init?.method ?? "GET",
    headers: { Authorization: process.env.CLICKUP_API_TOKEN!, "Content-Type": "application/json" },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const hint = res.status === 401 ? " (revisa CLICKUP_API_TOKEN)" : "";
    throw new Error(`ClickUp respondió ${res.status}${hint}: ${text.slice(0, 160)}`);
  }
  return (await res.json()) as T;
}

type Team = { id: string; name: string; members: { user: { id: number; username: string | null; email: string } }[] };

let cache: { at: number; value: Promise<ClickUpOptions> } | undefined;

/** Listas del espacio (con y sin carpeta) y personas del workspace. Se guarda 5 minutos. */
export function clickUpOptions(): Promise<ClickUpOptions> {
  if (!cache || Date.now() - cache.at > 5 * 60 * 1000) {
    const value = (async () => {
      const { teams } = await cu<{ teams: Team[] }>("team");
      const wanted = (process.env.CLICKUP_SPACE_NAME || "Marketing").trim().toLowerCase();
      for (const team of teams) {
        const { spaces } = await cu<{ spaces: { id: string; name: string }[] }>(`team/${team.id}/space?archived=false`);
        const space =
          spaces.find((s) => s.id === process.env.CLICKUP_SPACE_ID) ?? spaces.find((s) => s.name.trim().toLowerCase() === wanted);
        if (!space) continue;
        const [folderless, folders] = await Promise.all([
          cu<{ lists: { id: string; name: string }[] }>(`space/${space.id}/list?archived=false`),
          cu<{ folders: { name: string; lists: { id: string; name: string }[] }[] }>(`space/${space.id}/folder?archived=false`),
        ]);
        const lists: ClickUpList[] = [
          ...folderless.lists.map((l) => ({ id: String(l.id), name: l.name, folder: "" })),
          ...folders.folders.flatMap((f) => f.lists.map((l) => ({ id: String(l.id), name: l.name, folder: f.name }))),
        ];
        const members = team.members
          .map((m) => ({ id: m.user.id, name: m.user.username || m.user.email, email: m.user.email }))
          .sort((a, b) => a.name.localeCompare(b.name, "es"));
        return { space: space.name, lists, members };
      }
      throw new Error(`No se encontró el espacio “${process.env.CLICKUP_SPACE_NAME || "Marketing"}” en ClickUp.`);
    })();
    cache = { at: Date.now(), value };
    value.catch(() => (cache = undefined));
  }
  return cache.value;
}

export async function createClickUpTask(input: ClickUpTaskInput): Promise<ClickUpTaskResult> {
  if (!/^\d+$/.test(input.listId)) throw new Error("Elige la lista de ClickUp.");
  // Fecha límite al mediodía de Guatemala para que no cambie de día por la zona horaria.
  const due = input.dueDate ? Date.parse(`${input.dueDate}T12:00:00-06:00`) : null;
  const task = await cu<{ id: string; url: string }>(`list/${input.listId}/task`, {
    method: "POST",
    body: {
      name: input.name,
      markdown_description: input.description || undefined,
      assignees: input.assigneeId ? [input.assigneeId] : [],
      due_date: due ?? undefined,
      due_date_time: false,
    },
  });
  return { id: String(task.id), url: task.url };
}
