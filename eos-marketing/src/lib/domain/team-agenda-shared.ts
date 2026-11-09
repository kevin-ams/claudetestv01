export type AgendaStatus = "on_track" | "off_track";

/** Nota de la agenda: en qué trabajará una persona durante la semana (una por persona y semana). */
export type AgendaItem = {
  id: number;
  user_id: number;
  user_name: string;
  week_start: string;
  note: string;
  status: AgendaStatus;
  due_date: string | null;
  issue_id: number | null;
  updated_at: string;
};

export function isAgendaStatus(v: unknown): v is AgendaStatus {
  return v === "on_track" || v === "off_track";
}

/** Tarea de ClickUp candidata a agregarse a la nota. */
export type ClickUpWeekTask = {
  id: string;
  name: string;
  url: string;
  list: string;
  status: string;
  dueDate: string | null; // yyyy-mm-dd
  overdue: boolean;
  imported: boolean;
};

/** Línea que se agrega a la nota por cada tarea importada de ClickUp. */
export function clickUpLine(t: Pick<ClickUpWeekTask, "name" | "url" | "list" | "dueDate" | "overdue">): string {
  const due = t.dueDate ? ` (${t.dueDate.slice(8, 10)}/${t.dueDate.slice(5, 7)}${t.overdue ? ", vencida" : ""})` : "";
  return `• ${t.name}${due}${t.list ? ` · ${t.list}` : ""} ${t.url}`;
}
