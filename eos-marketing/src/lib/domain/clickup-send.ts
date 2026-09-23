import "server-only";
import { db } from "@/lib/db";
import { createClickUpTask, ClickUpNotConfiguredError } from "@/lib/integrations/clickup";
import { getUserById } from "./users";

export type SendResult = { ok: boolean; message: string; url?: string };

type Sendable = {
  id: number;
  team_id: number;
  title: string;
  description: string;
  due_date: string | null;
  owner_id: number | null;
  clickup_url: string | null;
};

/** Envía un To-Do o Issue a ClickUp y guarda la referencia de la tarea creada. */
export async function sendToClickUp(kind: "todo" | "issue", item: Sendable): Promise<SendResult> {
  if (item.clickup_url) {
    return { ok: true, message: "Ya estaba enviado a ClickUp.", url: item.clickup_url };
  }
  try {
    const owner = item.owner_id ? await getUserById(item.owner_id) : null;
    const task = await createClickUpTask({
      name: item.title,
      description: item.description,
      dueDate: item.due_date,
      assigneeEmail: owner && !owner.email.endsWith("@marketing.local") ? owner.email : null,
      source: kind,
    });
    if (kind === "todo") {
      await db().sql`
        UPDATE todos SET clickup_task_id = ${task.id}, clickup_url = ${task.url}, clickup_sent_at = NOW()
        WHERE id = ${item.id}
      `;
    } else {
      await db().sql`
        UPDATE issues SET clickup_task_id = ${task.id}, clickup_url = ${task.url}, clickup_sent_at = NOW()
        WHERE id = ${item.id}
      `;
    }
    return { ok: true, message: "Enviado a ClickUp.", url: task.url };
  } catch (err) {
    if (err instanceof ClickUpNotConfiguredError) return { ok: false, message: err.message };
    return { ok: false, message: err instanceof Error ? err.message : "No se pudo enviar a ClickUp." };
  }
}
