import "server-only";

/**
 * Integración con ClickUp para enviar To-Dos e Issues como tareas.
 *
 * Estado: PREPARADA, SIN CONECTAR. Los botones "Enviar a ClickUp" ya llaman
 * a `createClickUpTask`; para activarla falta:
 *   1. Definir CLICKUP_API_TOKEN (token personal o de la app) y
 *      CLICKUP_LIST_ID (lista donde se crearán las tareas).
 *   2. Implementar la llamada de abajo:
 *      POST https://api.clickup.com/api/v2/list/{CLICKUP_LIST_ID}/task
 *      con el header "Authorization: {token}" y el cuerpo
 *      { name, description, due_date (ms), assignees }.
 *   3. Devolver el id y la URL de la tarea creada; el sistema los guarda
 *      para mostrar el enlace y no enviarla dos veces.
 */

export type ClickUpTaskInput = {
  name: string;
  description: string;
  dueDate: string | null; // yyyy-mm-dd
  assigneeEmail: string | null;
  source: "todo" | "issue";
};

export type ClickUpTaskResult = { id: string; url: string };

export class ClickUpNotConfiguredError extends Error {
  constructor() {
    super("La conexión con ClickUp todavía no está configurada. La tarea queda guardada aquí.");
  }
}

export function isClickUpConfigured(): boolean {
  return Boolean(process.env.CLICKUP_API_TOKEN && process.env.CLICKUP_LIST_ID);
}

export async function createClickUpTask(input: ClickUpTaskInput): Promise<ClickUpTaskResult> {
  if (!isClickUpConfigured()) {
    throw new ClickUpNotConfiguredError();
  }
  // TODO(ClickUp): crear la tarea con la API v2 (ver arriba) y devolver { id, url }.
  void input;
  throw new Error("El envío a ClickUp aún no está implementado.");
}
